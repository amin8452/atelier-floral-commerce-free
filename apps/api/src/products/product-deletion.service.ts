import { BadRequestException, Injectable, Logger, NotFoundException, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { AdminAuditAction, ProductStatus } from "../generated/prisma/enums.js";
import { AuditService } from "../common/audit/audit.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { NotificationService } from "../notifications/notification.service.js";

export const PRODUCT_DELETION_GRACE_MS = 24 * 60 * 60 * 1_000;
const CLEANUP_INTERVAL_MS = 30_000;

export function deletionDeadline(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + PRODUCT_DELETION_GRACE_MS);
}

@Injectable()
export class ProductDeletionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProductDeletionService.name);
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    void this.purgeExpired().catch((error) => this.logger.error("Échec du nettoyage initial des produits", error));
    this.cleanupTimer = setInterval(() => {
      void this.purgeExpired().catch((error) => this.logger.error("Échec du nettoyage automatique des produits", error));
    }, CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }

  async schedule(id: string, actorId: string, ipAddress?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, status: true, deletionRequestedAt: true, deletionScheduledFor: true },
    });
    if (!product) throw new NotFoundException("Produit introuvable.");
    if (product.status !== ProductStatus.ARCHIVED) {
      throw new BadRequestException("Archivez le produit avant de le mettre à la corbeille.");
    }
    if (product.deletionScheduledFor) {
      return { ...product, notificationSent: false, alreadyScheduled: true };
    }

    const requestedAt = new Date();
    const scheduledFor = deletionDeadline(requestedAt);
    const scheduled = await this.prisma.product.update({
      where: { id },
      data: { deletionRequestedAt: requestedAt, deletionScheduledFor: scheduledFor, deletionRequestedById: actorId },
      select: { id: true, name: true, status: true, deletionRequestedAt: true, deletionScheduledFor: true },
    });
    await this.audit.record({
      actorId,
      action: AdminAuditAction.PRODUCT_DELETION_SCHEDULED,
      resourceType: "Product",
      resourceId: id,
      metadata: { scheduledFor: scheduledFor.toISOString() },
      ipAddress,
    });
    const notificationSent = await this.notifications.notifyAdminOfProductDeletion({ id, name: product.name, scheduledFor });
    return { ...scheduled, notificationSent, alreadyScheduled: false };
  }

  async cancel(id: string, actorId: string, ipAddress?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, deletionScheduledFor: true },
    });
    if (!product) throw new NotFoundException("Produit introuvable.");
    if (!product.deletionScheduledFor) throw new BadRequestException("Aucune suppression n’est programmée pour ce produit.");

    const restored = await this.prisma.product.update({
      where: { id },
      data: { deletionRequestedAt: null, deletionScheduledFor: null, deletionRequestedById: null },
      select: { id: true, name: true, status: true, deletionRequestedAt: true, deletionScheduledFor: true },
    });
    await this.audit.record({
      actorId,
      action: AdminAuditAction.PRODUCT_DELETION_CANCELLED,
      resourceType: "Product",
      resourceId: id,
      metadata: { previousDeadline: product.deletionScheduledFor.toISOString() },
      ipAddress,
    });
    return restored;
  }

  async purgeExpired(now = new Date()): Promise<number> {
    const expired = await this.prisma.product.findMany({
      where: { deletionScheduledFor: { lte: now } },
      orderBy: { deletionScheduledFor: "asc" },
      take: 100,
      select: { id: true },
    });
    let deletedCount = 0;
    for (const product of expired) {
      if (await this.deleteIfExpired(product.id, now)) deletedCount += 1;
    }
    return deletedCount;
  }

  private async deleteIfExpired(id: string, now: Date): Promise<boolean> {
    const deleted = await this.prisma.$transaction(async (tx) => {
      const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(hashtext(${id})) AS locked`;
      if (!lock?.locked) return null;
      const product = await tx.product.findFirst({
        where: { id, deletionScheduledFor: { lte: now } },
        select: { id: true, name: true, deletionScheduledFor: true, _count: { select: { cartItems: true, orderItems: true, leads: true, analytics: true } } },
      });
      if (!product) return null;

      await tx.cartItem.deleteMany({ where: { productId: id } });
      await tx.orderItem.updateMany({ where: { productId: id }, data: { productVariantId: null, productId: null } });
      await tx.lead.updateMany({ where: { productId: id }, data: { productVariantId: null, productId: null } });
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
      await tx.adminAudit.create({
        data: {
          action: AdminAuditAction.PRODUCT_DELETED,
          resourceType: "Product",
          resourceId: id,
          metadata: { name: product.name, scheduledFor: product.deletionScheduledFor?.toISOString(), detachedHistory: product._count, automatic: true },
        },
      });
      return product;
    });
    if (!deleted) return false;
    this.logger.log(`Produit ${id} supprimé après le délai de grâce de 24 heures.`);
    return true;
  }
}
