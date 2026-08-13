import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "../generated/prisma/client.js";
import { AdminAuditAction, ProductStatus } from "../generated/prisma/enums.js";
import { AuditService } from "../common/audit/audit.service.js";
import { paginationMeta } from "../common/pagination/pagination.dto.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import type { InventoryQueryDto, SetStockDto } from "./inventory.dto.js";
import { activeVariantStock } from "../products/product-stock.js";

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async list(query: InventoryQueryDto) {
    const threshold = this.config.getOrThrow<number>("LOW_STOCK_THRESHOLD");
    const term = query.search?.trim();
    const constraints: Prisma.ProductWhereInput[] = [];
    if (term) constraints.push({ OR: [{ name: { contains: term, mode: "insensitive" } }, { sku: { contains: term, mode: "insensitive" } }, { variants: { some: { sku: { contains: term, mode: "insensitive" } } } }] });
    if (query.lowStockOnly) constraints.push({ OR: [{ stock: { lte: threshold } }, { variants: { some: { isActive: true, stock: { lte: threshold } } } }] });
    const where: Prisma.ProductWhereInput = {
      status: { not: ProductStatus.ARCHIVED },
      ...(constraints.length ? { AND: constraints } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: { id: true, name: true, sku: true, stock: true, status: true, updatedAt: true, variants: { orderBy: { name: "asc" }, select: { id: true, name: true, sku: true, stock: true, isActive: true } } },
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      items: items.map((product) => ({
        ...product,
        stock: product.variants.some((variant) => variant.isActive)
          ? activeVariantStock(product.variants)
          : product.stock,
      })),
      threshold,
      meta: paginationMeta(query.page, query.pageSize, total),
    };
  }

  async setStock(dto: SetStockDto, actorId: string, ipAddress?: string) {
    const adjustment = await this.prisma.$transaction(async (tx) => {
      if (dto.variantId) {
        const variant = await tx.productVariant.findFirst({
          where: { id: dto.variantId, productId: dto.productId },
          select: { id: true, stock: true },
        });
        if (!variant) throw new BadRequestException("La variante n’appartient pas à ce produit.");

        await tx.productVariant.update({ where: { id: variant.id }, data: { stock: dto.stock } });
        const variants = await tx.productVariant.findMany({
          where: { productId: dto.productId, isActive: true },
          select: { stock: true },
        });
        const totalStock = activeVariantStock(variants);
        await tx.product.update({ where: { id: dto.productId }, data: { stock: totalStock } });
        return { previousStock: variant.stock, totalStock };
      }

      const product = await tx.product.findUnique({
        where: { id: dto.productId },
        select: { id: true, stock: true, variants: { where: { isActive: true }, select: { id: true } } },
      });
      if (!product) throw new NotFoundException("Produit introuvable.");
      if (product.variants.length) {
        throw new BadRequestException("Le stock de ce produit est géré par ses variantes.");
      }
      await tx.product.update({ where: { id: product.id }, data: { stock: dto.stock } });
      return { previousStock: product.stock, totalStock: dto.stock };
    });

    await this.audit.record({
      actorId,
      action: AdminAuditAction.STOCK_ADJUSTED,
      resourceType: dto.variantId ? "ProductVariant" : "Product",
      resourceId: dto.variantId ?? dto.productId,
      metadata: { productId: dto.productId, previousStock: adjustment.previousStock, stock: dto.stock, totalStock: adjustment.totalStock },
      ipAddress,
    });
    return { success: true, stock: dto.stock, totalStock: adjustment.totalStock };
  }
}
