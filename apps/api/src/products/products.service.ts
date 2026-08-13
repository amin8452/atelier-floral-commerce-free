import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Decimal } from "decimal.js";
import type { Prisma } from "../generated/prisma/client.js";
import { AdminAuditAction, ProductStatus } from "../generated/prisma/enums.js";
import { AuditService } from "../common/audit/audit.service.js";
import { paginationMeta } from "../common/pagination/pagination.dto.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import type {
  AdminProductQueryDto,
  CreateProductDto,
  ProductImageInputDto,
  ProductQueryDto,
  ProductVariantInputDto,
  UpdateProductDto,
} from "./product.dto.js";
import { ProductSort } from "./product.dto.js";
import { productPublicationError, type ProductPublicationCandidate } from "./product-publication.js";
import { activeVariantStock, productStock } from "./product-stock.js";

const publicProductSelect = {
  id: true,
  slug: true,
  name: true,
  shortDescription: true,
  basePrice: true,
  salePrice: true,
  stock: true,
  personalizationSchema: true,
  variants: { where: { isActive: true }, take: 1, select: { id: true } },
  images: {
    take: 1,
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    select: { altText: true, asset: { select: { url: true } } },
  },
} satisfies Prisma.ProductSelect;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listActive(query: ProductQueryDto) {
    const where = this.publicWhere(query);
    const orderBy = this.orderBy(query.sort);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: publicProductSelect,
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items: items.map((product) => this.mapListItem(product)), meta: paginationMeta(query.page, query.pageSize, total) };
  }

  async bySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.ACTIVE, publishedAt: { lte: new Date() } },
      select: {
        id: true,
        slug: true,
        name: true,
        sku: true,
        shortDescription: true,
        description: true,
        basePrice: true,
        salePrice: true,
        stock: true,
        tags: true,
        personalizationSchema: true,
        metaTitle: true,
        metaDescription: true,
        images: {
          orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
          select: { id: true, altText: true, sortOrder: true, isPrimary: true, variantId: true, asset: { select: { url: true } } },
        },
        variants: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, sku: true, options: true, price: true, salePrice: true, stock: true },
        },
        category: { select: { name: true, slug: true } },
        collections: { select: { collection: { select: { name: true, slug: true } } } },
      },
    });
    if (!product) throw new NotFoundException("Produit introuvable.");
    return {
      ...product,
      basePrice: product.basePrice.toString(),
      salePrice: product.salePrice?.toString() ?? null,
      images: product.images.map(({ asset, ...image }) => ({ ...image, url: asset.url })),
      variants: product.variants.map((variant) => ({
        ...variant,
        price: variant.price?.toString() ?? null,
        salePrice: variant.salePrice?.toString() ?? null,
      })),
      collections: product.collections.map((entry) => entry.collection),
    };
  }

  async listAdmin(query: AdminProductQueryDto) {
    const where: Prisma.ProductWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search ? this.searchFilter(query.search) : {}),
    };
    const [items, total, scheduledDeletions] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          category: { select: { id: true, name: true } },
          images: { take: 1, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], include: { asset: true } },
          variants: { where: { isActive: true }, select: { stock: true } },
          _count: { select: { variants: true, leads: true, orderItems: true } },
        },
      }),
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where: { deletionScheduledFor: { not: null } },
        orderBy: { deletionScheduledFor: "asc" },
        select: { id: true, name: true, deletionScheduledFor: true },
      }),
    ]);
    return {
      items: items.map(({ variants, ...product }) => ({
        ...product,
        stock: variants.length ? activeVariantStock(variants) : product.stock,
      })),
      meta: paginationMeta(query.page, query.pageSize, total),
      scheduledDeletions,
    };
  }

  async getAdmin(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { createdAt: "asc" } },
        images: { orderBy: { sortOrder: "asc" }, include: { asset: true } },
        collections: true,
      },
    });
    if (!product) throw new NotFoundException("Produit introuvable.");
    return product;
  }

  async create(dto: CreateProductDto, actorId: string, ipAddress?: string) {
    this.validatePrices(dto.basePrice, dto.salePrice);
    for (const variant of dto.variants ?? []) {
      this.validatePrices(variant.price ?? dto.basePrice, variant.salePrice);
    }
    if (dto.status === ProductStatus.ACTIVE) {
      this.validatePublication({
        name: dto.name,
        basePrice: dto.basePrice,
        ...(dto.shortDescription !== undefined ? { shortDescription: dto.shortDescription } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        stock: dto.stock,
        ...(dto.variants !== undefined ? { variants: dto.variants } : {}),
      });
    }
    const product = await this.prisma.$transaction(async (tx) => {
      await this.validateAssets(tx, dto.images ?? [], undefined);
      return tx.product.create({
        data: {
          name: dto.name.trim(),
          slug: dto.slug.trim().toLowerCase(),
          shortDescription: this.optionalText(dto.shortDescription),
          description: this.optionalText(dto.description),
          sku: this.optionalText(dto.sku),
          basePrice: dto.basePrice,
          salePrice: dto.salePrice ?? null,
          stock: productStock(dto.stock, dto.variants),
          status: dto.status ?? ProductStatus.DRAFT,
          tags: dto.tags?.map((tag) => tag.trim()).filter(Boolean) ?? [],
          metaTitle: this.optionalText(dto.metaTitle),
          metaDescription: this.optionalText(dto.metaDescription),
          publishedAt: dto.status === ProductStatus.ACTIVE ? new Date() : null,
          ...(dto.categoryId ? { category: { connect: { id: dto.categoryId } } } : {}),
          ...(dto.personalizationSchema ? { personalizationSchema: dto.personalizationSchema as Prisma.InputJsonValue } : {}),
          ...(dto.variants?.length ? { variants: { create: dto.variants.map((variant) => this.variantCreateData(variant)) } } : {}),
          ...(dto.collectionIds?.length
            ? { collections: { create: dto.collectionIds.map((collectionId, sortOrder) => ({ collectionId, sortOrder })) } }
            : {}),
          ...(dto.images?.length ? { images: { create: dto.images.map((image) => this.imageCreateData(image, undefined)) } } : {}),
        },
      });
    });
    await this.audit.record({ actorId, action: AdminAuditAction.PRODUCT_CREATED, resourceType: "Product", resourceId: product.id, ipAddress });
    return this.getAdmin(product.id);
  }

  async update(id: string, dto: UpdateProductDto, actorId: string, ipAddress?: string) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        name: true,
        shortDescription: true,
        description: true,
        basePrice: true,
        salePrice: true,
        stock: true,
        publishedAt: true,
        deletionScheduledFor: true,
        variants: { select: { stock: true, isActive: true } },
      },
    });
    if (!existing) throw new NotFoundException("Produit introuvable.");
    if (existing.deletionScheduledFor) throw new BadRequestException("Annulez la suppression programmée avant de modifier ce produit.");
    this.validatePrices(dto.basePrice ?? existing.basePrice.toString(), dto.salePrice === undefined ? existing.salePrice?.toString() : dto.salePrice);
    const resultingStatus = dto.status ?? existing.status;
    if (resultingStatus === ProductStatus.ACTIVE) {
      this.validatePublication({
        name: dto.name ?? existing.name,
        basePrice: dto.basePrice ?? existing.basePrice.toString(),
        shortDescription: dto.shortDescription === undefined ? existing.shortDescription : dto.shortDescription,
        description: dto.description === undefined ? existing.description : dto.description,
        stock: dto.stock ?? existing.stock,
        variants: dto.variants ?? existing.variants,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: this.scalarUpdateData(dto, existing.publishedAt) });

      if (dto.collectionIds) {
        await tx.productCollection.deleteMany({ where: { productId: id } });
        if (dto.collectionIds.length) {
          await tx.productCollection.createMany({ data: dto.collectionIds.map((collectionId, sortOrder) => ({ productId: id, collectionId, sortOrder })) });
        }
      }

      if (dto.variants) {
        const retainedVariantIds = dto.variants.flatMap((variant) => variant.id ? [variant.id] : []);
        await tx.productVariant.updateMany({
          where: { productId: id, ...(retainedVariantIds.length ? { id: { notIn: retainedVariantIds } } : {}) },
          data: { isActive: false },
        });
        for (const variant of dto.variants) {
          this.validatePrices(variant.price ?? dto.basePrice ?? existing.basePrice.toString(), variant.salePrice);
          if (variant.id) {
            const updated = await tx.productVariant.updateMany({
              where: { id: variant.id, productId: id },
              data: this.variantUpdateData(variant),
            });
            if (updated.count !== 1) throw new BadRequestException("Une variante n'appartient pas à ce produit.");
          } else {
            await tx.productVariant.create({ data: { productId: id, ...this.variantCreateData(variant) } });
          }
        }
      }

      if (dto.images) {
        await this.validateAssets(tx, dto.images, id);
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (dto.images.length) {
          await tx.productImage.createMany({ data: dto.images.map((image) => ({ productId: id, ...this.imageCreateData(image, id) })) });
        }
      }
    });
    await this.audit.record({ actorId, action: AdminAuditAction.PRODUCT_UPDATED, resourceType: "Product", resourceId: id, ipAddress });
    return this.getAdmin(id);
  }

  async archive(id: string, actorId: string, ipAddress?: string) {
    const result = await this.prisma.product.update({ where: { id }, data: { status: ProductStatus.ARCHIVED } });
    await this.audit.record({ actorId, action: AdminAuditAction.PRODUCT_ARCHIVED, resourceType: "Product", resourceId: id, ipAddress });
    return result;
  }

  async duplicate(id: string, actorId: string, ipAddress?: string) {
    const source = await this.getAdmin(id);
    if (source.deletionScheduledFor) throw new BadRequestException("Un produit placé dans la corbeille ne peut pas être dupliqué.");
    const suffix = Date.now().toString(36);
    const copy = await this.prisma.product.create({
      data: {
        name: `${source.name} — copie`,
        slug: `${source.slug}-copie-${suffix}`,
        shortDescription: source.shortDescription,
        description: source.description,
        basePrice: source.basePrice,
        salePrice: source.salePrice,
        stock: source.stock,
        status: ProductStatus.DRAFT,
        tags: source.tags,
        ...(source.personalizationSchema !== null ? { personalizationSchema: source.personalizationSchema as Prisma.InputJsonValue } : {}),
        metaTitle: source.metaTitle,
        metaDescription: source.metaDescription,
        categoryId: source.categoryId,
        variants: {
          create: source.variants.map((variant) => ({
            name: variant.name,
            sku: `${variant.sku}-COPY-${suffix}`.slice(0, 100),
            options: (variant.options ?? {}) as Prisma.InputJsonValue,
            price: variant.price,
            salePrice: variant.salePrice,
            stock: variant.stock,
            isActive: variant.isActive,
          })),
        },
        collections: { create: source.collections.map((entry) => ({ collectionId: entry.collectionId, sortOrder: entry.sortOrder })) },
        images: {
          create: source.images.map((image) => ({ assetId: image.assetId, altText: image.altText, sortOrder: image.sortOrder, isPrimary: image.isPrimary })),
        },
      },
    });
    await this.audit.record({ actorId, action: AdminAuditAction.PRODUCT_DUPLICATED, resourceType: "Product", resourceId: copy.id, metadata: { sourceId: id }, ipAddress });
    return this.getAdmin(copy.id);
  }

  private publicWhere(query: ProductQueryDto): Prisma.ProductWhereInput {
    const constraints: Prisma.ProductWhereInput[] = [];
    if (query.search) constraints.push(this.searchFilter(query.search));
    if (query.available) {
      constraints.push({ OR: [{ stock: { gt: 0 } }, { variants: { some: { isActive: true, stock: { gt: 0 } } } }] });
    }
    return {
      status: ProductStatus.ACTIVE,
      publishedAt: { lte: new Date() },
      ...(constraints.length ? { AND: constraints } : {}),
      ...(query.category ? { category: { slug: query.category, isActive: true } } : {}),
      ...(query.collection ? { collections: { some: { collection: { slug: query.collection, isActive: true } } } } : {}),
      ...(query.minPrice || query.maxPrice
        ? { basePrice: { ...(query.minPrice ? { gte: query.minPrice } : {}), ...(query.maxPrice ? { lte: query.maxPrice } : {}) } }
        : {}),
    };
  }

  private searchFilter(search: string): Prisma.ProductWhereInput {
    const terms = [...new Set(search.trim().split(/\s+/).filter(Boolean))].slice(0, 6);
    return {
      AND: terms.map((value) => ({
        OR: [
          { name: { contains: value, mode: "insensitive" } },
          { sku: { contains: value, mode: "insensitive" } },
          { shortDescription: { contains: value, mode: "insensitive" } },
          { description: { contains: value, mode: "insensitive" } },
          { tags: { has: value } },
          { category: { name: { contains: value, mode: "insensitive" } } },
          { collections: { some: { collection: { name: { contains: value, mode: "insensitive" } } } } },
        ],
      })),
    };
  }

  private orderBy(sort: ProductSort): Prisma.ProductOrderByWithRelationInput {
    if (sort === ProductSort.PRICE_ASC) return { basePrice: "asc" };
    if (sort === ProductSort.PRICE_DESC) return { basePrice: "desc" };
    if (sort === ProductSort.POPULAR) return { analytics: { _count: "desc" } };
    return { publishedAt: "desc" };
  }

  private mapListItem(product: {
    id: string;
    slug: string;
    name: string;
    shortDescription: string | null;
    basePrice: Decimal;
    salePrice: Decimal | null;
    stock: number;
    personalizationSchema: unknown;
    variants: Array<{ id: string }>;
    images: Array<{ altText: string; asset: { url: string } }>;
  }) {
    const { personalizationSchema, variants, ...publicProduct } = product;
    return {
      ...publicProduct,
      basePrice: product.basePrice.toString(),
      salePrice: product.salePrice?.toString() ?? null,
      images: product.images.map((image) => ({ url: image.asset.url, altText: image.altText })),
      canQuickOrder: variants.length === 0 && personalizationSchema === null,
    };
  }

  private scalarUpdateData(dto: UpdateProductDto, publishedAt: Date | null): Prisma.ProductUpdateInput {
    const resolvedStock = dto.stock === undefined
      ? undefined
      : productStock(dto.stock, dto.variants);
    return {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.slug !== undefined ? { slug: dto.slug.trim().toLowerCase() } : {}),
      ...(dto.shortDescription !== undefined ? { shortDescription: this.optionalText(dto.shortDescription) } : {}),
      ...(dto.description !== undefined ? { description: this.optionalText(dto.description) } : {}),
      ...(dto.sku !== undefined ? { sku: this.optionalText(dto.sku) } : {}),
      ...(dto.basePrice !== undefined ? { basePrice: dto.basePrice } : {}),
      ...(dto.salePrice !== undefined ? { salePrice: dto.salePrice } : {}),
      ...(resolvedStock !== undefined ? { stock: resolvedStock } : {}),
      ...(dto.status !== undefined ? { status: dto.status, publishedAt: dto.status === ProductStatus.ACTIVE ? publishedAt ?? new Date() : publishedAt } : {}),
      ...(dto.categoryId !== undefined ? { category: dto.categoryId ? { connect: { id: dto.categoryId } } : { disconnect: true } } : {}),
      ...(dto.tags !== undefined ? { tags: dto.tags.map((tag) => tag.trim()).filter(Boolean) } : {}),
      ...(dto.personalizationSchema !== undefined ? { personalizationSchema: dto.personalizationSchema as Prisma.InputJsonValue } : {}),
      ...(dto.metaTitle !== undefined ? { metaTitle: this.optionalText(dto.metaTitle) } : {}),
      ...(dto.metaDescription !== undefined ? { metaDescription: this.optionalText(dto.metaDescription) } : {}),
    };
  }

  private optionalText(value: string | null | undefined): string | null {
    return value?.trim() || null;
  }

  private variantCreateData(variant: ProductVariantInputDto): Prisma.ProductVariantCreateWithoutProductInput {
    return {
      name: variant.name.trim(),
      sku: variant.sku.trim(),
      options: variant.options,
      price: variant.price ?? null,
      salePrice: variant.salePrice ?? null,
      stock: variant.stock,
      isActive: variant.isActive ?? true,
    };
  }

  private variantUpdateData(variant: ProductVariantInputDto): Prisma.ProductVariantUpdateManyMutationInput {
    return this.variantCreateData(variant);
  }

  private imageCreateData(image: ProductImageInputDto, productId: string | undefined) {
    return {
      assetId: image.assetId,
      ...(productId && image.variantId ? { variantId: image.variantId } : {}),
      altText: image.altText.trim(),
      sortOrder: image.sortOrder,
      isPrimary: image.isPrimary ?? false,
    };
  }

  private async validateAssets(tx: Prisma.TransactionClient, images: ProductImageInputDto[], productId: string | undefined): Promise<void> {
    if (!images.length) return;
    const uniqueAssetIds = [...new Set(images.map((image) => image.assetId))];
    if ((await tx.mediaAsset.count({ where: { id: { in: uniqueAssetIds } } })) !== uniqueAssetIds.length) {
      throw new BadRequestException("Un média sélectionné est introuvable.");
    }
    const variantIds = images.flatMap((image) => (image.variantId ? [image.variantId] : []));
    if (variantIds.length && (!productId || (await tx.productVariant.count({ where: { id: { in: variantIds }, productId } })) !== new Set(variantIds).size)) {
      throw new BadRequestException("Une variante d'image n'appartient pas à ce produit.");
    }
    if (images.filter((image) => image.isPrimary).length > 1) {
      throw new BadRequestException("Une seule image principale est autorisée.");
    }
  }

  private validatePrices(basePrice: string, salePrice: string | null | undefined): void {
    const base = new Decimal(basePrice);
    if (base.isNegative()) throw new BadRequestException("Le prix ne peut pas être négatif.");
    if (salePrice !== null && salePrice !== undefined) {
      const sale = new Decimal(salePrice);
      if (sale.isNegative() || sale.greaterThanOrEqualTo(base)) {
        throw new BadRequestException("Le prix promotionnel doit être positif et inférieur au prix normal.");
      }
    }
  }

  private validatePublication(candidate: ProductPublicationCandidate): void {
    const error = productPublicationError(candidate);
    if (error) throw new BadRequestException(error);
  }
}
