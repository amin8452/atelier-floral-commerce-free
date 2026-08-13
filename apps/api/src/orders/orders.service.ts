import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Decimal } from "decimal.js";
import type { Prisma } from "../generated/prisma/client.js";
import {
  AdminAuditAction,
  AnalyticsEventType,
  FulfillmentStatus,
  PaymentMethod,
  PaymentStatus,
  ProductStatus,
} from "../generated/prisma/enums.js";
import { AuditService } from "../common/audit/audit.service.js";
import { paginationMeta, type PaginationDto } from "../common/pagination/pagination.dto.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { hashToken } from "../common/security/tokens.js";
import { PaymentsService } from "../payments/payments.service.js";
import { calculatePricing, effectivePrice, serializePricing } from "../pricing/pricing.js";
import { PromotionsService } from "../promotions/promotions.service.js";
import type { CheckoutDto, UpdateOrderStatusDto } from "./order.dto.js";
import { completedPaymentStatus, orderCompletionError } from "./order-completion.js";
import { randomUUID } from "node:crypto";

const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  PENDING: [PaymentStatus.PAID, PaymentStatus.FAILED, PaymentStatus.CANCELLED],
  PAID: [PaymentStatus.REFUNDED],
  FAILED: [PaymentStatus.PENDING, PaymentStatus.CANCELLED],
  REFUNDED: [],
  CANCELLED: [],
};

const FULFILLMENT_TRANSITIONS: Record<FulfillmentStatus, readonly FulfillmentStatus[]> = {
  NEW: [FulfillmentStatus.PROCESSING, FulfillmentStatus.CANCELLED],
  PROCESSING: [FulfillmentStatus.READY, FulfillmentStatus.CANCELLED],
  READY: [FulfillmentStatus.SHIPPED, FulfillmentStatus.CANCELLED],
  SHIPPED: [FulfillmentStatus.DELIVERED],
  DELIVERED: [],
  CANCELLED: [],
};

export function isPaymentTransitionAllowed(current: PaymentStatus, next: PaymentStatus): boolean {
  return current === next || PAYMENT_TRANSITIONS[current].includes(next);
}

export function isFulfillmentTransitionAllowed(current: FulfillmentStatus, next: FulfillmentStatus): boolean {
  return current === next || FULFILLMENT_TRANSITIONS[current].includes(next);
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promotions: PromotionsService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
  ) {}

  async checkout(cartToken: string, idempotencyKey: string, dto: CheckoutDto) {
    const existing = await this.prisma.order.findUnique({ where: { idempotencyKey } });
    if (existing) return this.checkoutResponse(existing);

    try {
      const order = await this.prisma.$transaction(
        async (tx) => {
          const duplicate = await tx.order.findUnique({ where: { idempotencyKey } });
          if (duplicate) return duplicate;
          const cart = await tx.cart.findUnique({
            where: { tokenHash: hashToken(cartToken) },
            include: {
              items: {
                include: {
                  product: { include: { variants: { where: { isActive: true }, select: { id: true } } } },
                  productVariant: true,
                },
              },
            },
          });
          if (!cart || cart.expiresAt <= new Date() || cart.items.length === 0) throw new BadRequestException("Panier vide ou expiré.");

          const settings = await tx.storeSettings.findUniqueOrThrow({ where: { id: "store" } });
          if (dto.paymentMethod !== PaymentMethod.CASH_ON_DELIVERY || !settings.codEnabled) {
            throw new BadRequestException("Méthode de paiement indisponible.");
          }

          const lines = cart.items.map((item) => {
            if (item.product.status !== ProductStatus.ACTIVE || !item.product.publishedAt || item.product.publishedAt > new Date()) {
              throw new BadRequestException(`Le produit « ${item.product.name} » n'est plus disponible.`);
            }
            if (item.productVariantId && (!item.productVariant || !item.productVariant.isActive)) {
              throw new BadRequestException(`Une variante de « ${item.product.name} » n'est plus disponible.`);
            }
            if (!item.productVariantId && item.product.variants.length > 0) {
              throw new BadRequestException(`Une variante doit être sélectionnée pour « ${item.product.name} ».`);
            }
            return { item, unitPrice: effectivePrice(item.product, item.productVariant) };
          });
          const preliminarySubtotal = lines.reduce((sum, line) => sum.plus(line.unitPrice.times(line.item.quantity)), new Decimal(0));
          const promotion = await this.promotions.resolveForCheckout(dto.promotionCode, preliminarySubtotal, tx);
          const pricing = calculatePricing(
            lines.map((line) => ({ unitPrice: line.unitPrice, quantity: line.item.quantity })),
            promotion ? { discountType: promotion.discountType, discountValue: promotion.discountValue.toString() } : null,
            settings.shippingEnabled ? settings.shippingFlatRate.toString() : 0,
            settings.taxRate.toString(),
          );

          for (const line of lines) {
            const updated = line.item.productVariantId
              ? await tx.productVariant.updateMany({
                  where: { id: line.item.productVariantId, productId: line.item.productId, isActive: true, stock: { gte: line.item.quantity } },
                  data: { stock: { decrement: line.item.quantity } },
                })
              : await tx.product.updateMany({
                  where: { id: line.item.productId, status: ProductStatus.ACTIVE, stock: { gte: line.item.quantity } },
                  data: { stock: { decrement: line.item.quantity } },
                });
            if (updated.count !== 1) throw new ConflictException(`Stock insuffisant pour « ${line.item.product.name} ».`);
          }

          if (promotion) {
            const claimed = await tx.promotion.updateMany({
              where: { id: promotion.id, usageCount: promotion.usageCount },
              data: { usageCount: { increment: 1 } },
            });
            if (claimed.count !== 1) throw new ConflictException("La promotion vient d'atteindre sa limite.");
          }

          const customer = await tx.customer.create({
            data: {
              firstName: dto.customer.firstName.trim(),
              lastName: dto.customer.lastName.trim(),
              phone: dto.customer.phone.trim(),
              email: dto.customer.email?.trim().toLowerCase() || null,
              addresses: {
                create: {
                  firstName: dto.customer.firstName.trim(),
                  lastName: dto.customer.lastName.trim(),
                  phone: dto.customer.phone.trim(),
                  line1: dto.shippingAddress.line1.trim(),
                  line2: dto.shippingAddress.line2?.trim() || null,
                  city: dto.shippingAddress.city.trim(),
                  postalCode: dto.shippingAddress.postalCode?.trim() || null,
                  country: dto.shippingAddress.country.toUpperCase(),
                },
              },
            },
          });
          const orderNumber = this.orderNumber();
          const payment = this.payments.createPending(dto.paymentMethod, pricing.total, settings.defaultCurrency, `payment:${idempotencyKey}`);
          const created = await tx.order.create({
            data: {
              orderNumber,
              idempotencyKey,
              customerId: customer.id,
              customerSnapshot: {
                firstName: dto.customer.firstName.trim(),
                lastName: dto.customer.lastName.trim(),
                phone: dto.customer.phone.trim(),
                email: dto.customer.email?.trim().toLowerCase() || null,
              },
              shippingAddress: {
                ...dto.shippingAddress,
                line1: dto.shippingAddress.line1.trim(),
                line2: dto.shippingAddress.line2?.trim() || null,
                city: dto.shippingAddress.city.trim(),
                postalCode: dto.shippingAddress.postalCode?.trim() || null,
                country: dto.shippingAddress.country.toUpperCase(),
              },
              notes: dto.notes?.trim() || null,
              currency: settings.defaultCurrency,
              promotionCode: promotion?.code ?? null,
              ...serializePricing(pricing),
              items: {
                create: lines.map(({ item, unitPrice }) => ({
                  product: { connect: { id: item.productId } },
                  ...(item.productVariantId ? { productVariant: { connect: { id_productId: { id: item.productVariantId, productId: item.productId } } } } : {}),
                  productNameSnapshot: item.product.name,
                  skuSnapshot: item.productVariant?.sku ?? item.product.sku,
                  ...(item.productVariant
                    ? { variantSnapshot: { id: item.productVariant.id, name: item.productVariant.name, options: item.productVariant.options } as Prisma.InputJsonValue }
                    : {}),
                  unitPrice,
                  quantity: item.quantity,
                  ...(item.personalization !== null ? { personalization: item.personalization as Prisma.InputJsonValue } : {}),
                  total: unitPrice.times(item.quantity),
                })),
              },
              payments: { create: payment },
              activities: { create: { paymentStatus: PaymentStatus.PENDING, fulfillmentStatus: FulfillmentStatus.NEW } },
            },
          });
          await tx.analyticsEvent.createMany({
            data: lines.map((line) => ({ type: AnalyticsEventType.PURCHASE, productId: line.item.productId, orderId: created.id })),
          });
          await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
          return created;
        },
        { isolationLevel: "Serializable", maxWait: 5_000, timeout: 15_000 },
      );
      return this.checkoutResponse(order);
    } catch (error) {
      const duplicate = await this.prisma.order.findUnique({ where: { idempotencyKey } });
      if (duplicate) return this.checkoutResponse(duplicate);
      throw error;
    }
  }

  async listAdmin(query: PaginationDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          orderNumber: true,
          customerSnapshot: true,
          currency: true,
          total: true,
          paymentStatus: true,
          fulfillmentStatus: true,
          createdAt: true,
          payments: { take: 1, select: { method: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count(),
    ]);
    return { items, meta: paginationMeta(query.page, query.pageSize, total) };
  }

  async getAdmin(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true, payments: true, activities: { orderBy: { createdAt: "asc" }, include: { createdBy: { select: { id: true, firstName: true, lastName: true } } } } },
    });
    if (!order) throw new NotFoundException("Commande introuvable.");
    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto, actorId: string, ipAddress?: string) {
    if (!dto.paymentStatus && !dto.fulfillmentStatus && !dto.note?.trim()) throw new BadRequestException("Aucune modification fournie.");
    const order = await this.prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!current) throw new NotFoundException("Commande introuvable.");
      if (dto.paymentStatus && !isPaymentTransitionAllowed(current.paymentStatus, dto.paymentStatus)) {
        throw new BadRequestException("Transition de paiement invalide.");
      }
      if (dto.fulfillmentStatus && !isFulfillmentTransitionAllowed(current.fulfillmentStatus, dto.fulfillmentStatus)) {
        throw new BadRequestException("Transition de traitement invalide.");
      }

      const isNewCancellation = dto.fulfillmentStatus === FulfillmentStatus.CANCELLED && current.fulfillmentStatus !== FulfillmentStatus.CANCELLED;
      if (isNewCancellation) {
        for (const item of current.items) {
          if (!item.productId) continue;
          if (item.productVariantId) {
            await tx.productVariant.updateMany({
              where: { id: item.productVariantId, productId: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          } else {
            await tx.product.updateMany({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
          }
        }
        if (current.promotionCode) {
          await tx.promotion.updateMany({
            where: { code: current.promotionCode, usageCount: { gt: 0 } },
            data: { usageCount: { decrement: 1 } },
          });
        }
      }

      const updated = await tx.order.update({
        where: { id },
        data: {
          ...(dto.paymentStatus ? { paymentStatus: dto.paymentStatus } : {}),
          ...(dto.fulfillmentStatus ? { fulfillmentStatus: dto.fulfillmentStatus } : {}),
        },
      });
      if (dto.paymentStatus && dto.paymentStatus !== current.paymentStatus) {
        await tx.payment.updateMany({ where: { orderId: id, status: current.paymentStatus }, data: { status: dto.paymentStatus } });
      }
      await tx.orderActivity.create({
        data: {
          orderId: id,
          paymentStatus: dto.paymentStatus ?? null,
          fulfillmentStatus: dto.fulfillmentStatus ?? null,
          note: dto.note?.trim() || null,
          createdById: actorId,
        },
      });
      return updated;
    }, { isolationLevel: "Serializable" });
    await this.audit.record({
      actorId,
      action: AdminAuditAction.ORDER_STATUS_CHANGED,
      resourceType: "Order",
      resourceId: id,
      metadata: {
        ...(dto.paymentStatus ? { paymentStatus: dto.paymentStatus } : {}),
        ...(dto.fulfillmentStatus ? { fulfillmentStatus: dto.fulfillmentStatus } : {}),
      },
      ipAddress,
    });
    return order;
  }

  async complete(id: string, actorId: string, ipAddress?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id },
        include: { payments: { select: { method: true } } },
      });
      if (!current) throw new NotFoundException("Commande introuvable.");

      const completionState = {
        fulfillmentStatus: current.fulfillmentStatus,
        paymentStatus: current.paymentStatus,
        paymentMethods: current.payments.map((payment) => payment.method),
      };
      const completionError = orderCompletionError(completionState);
      if (completionError) throw new BadRequestException(completionError);

      const paymentStatus = completedPaymentStatus(completionState);
      if (current.fulfillmentStatus === FulfillmentStatus.DELIVERED && current.paymentStatus === paymentStatus) {
        return { order: current, changed: false };
      }

      const order = await tx.order.update({
        where: { id },
        data: { fulfillmentStatus: FulfillmentStatus.DELIVERED, paymentStatus },
      });
      if (paymentStatus !== current.paymentStatus) {
        await tx.payment.updateMany({
          where: { orderId: id, status: current.paymentStatus },
          data: { status: paymentStatus },
        });
      }
      await tx.orderActivity.create({
        data: {
          orderId: id,
          paymentStatus: paymentStatus !== current.paymentStatus ? paymentStatus : null,
          fulfillmentStatus: FulfillmentStatus.DELIVERED,
          note: "Commande terminée depuis l’action rapide.",
          createdById: actorId,
        },
      });
      return { order, changed: true };
    }, { isolationLevel: "Serializable" });

    if (result.changed) {
      await this.audit.record({
        actorId,
        action: AdminAuditAction.ORDER_STATUS_CHANGED,
        resourceType: "Order",
        resourceId: id,
        metadata: { paymentStatus: result.order.paymentStatus, fulfillmentStatus: result.order.fulfillmentStatus, quickCompletion: true },
        ipAddress,
      });
    }
    return result.order;
  }

  private checkoutResponse(order: { orderNumber: string; currency: string; total: Decimal; paymentStatus: PaymentStatus; fulfillmentStatus: FulfillmentStatus; createdAt: Date }) {
    return { ...order, total: order.total.toFixed(3) };
  }

  private orderNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    return `AF-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
  }
}
