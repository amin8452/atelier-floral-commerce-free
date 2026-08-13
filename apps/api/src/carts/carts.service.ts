import { BadRequestException, GoneException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Decimal } from "decimal.js";
import type { Prisma } from "../generated/prisma/client.js";
import { AnalyticsEventType, ProductStatus } from "../generated/prisma/enums.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { createOpaqueToken, hashToken } from "../common/security/tokens.js";
import { effectivePrice } from "../pricing/pricing.js";
import type { AddCartItemDto } from "./cart.dto.js";

@Injectable()
export class CartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create() {
    const token = createOpaqueToken();
    const expiresAt = new Date(Date.now() + this.config.getOrThrow<number>("CART_TTL_DAYS") * 24 * 60 * 60 * 1000);
    await this.prisma.cart.create({ data: { tokenHash: hashToken(token), expiresAt } });
    return { token, expiresAt };
  }

  async get(token: string) {
    const cart = await this.findCart(token);
    const settings = await this.prisma.storeSettings.findUniqueOrThrow({ where: { id: "store" }, select: { defaultCurrency: true, defaultLocale: true } });
    const items = cart.items.map((item) => {
      const unitPrice = effectivePrice(item.product, item.productVariant);
      return {
        id: item.id,
        productId: item.productId,
        variantId: item.productVariantId,
        name: item.product.name,
        slug: item.product.slug,
        sku: item.productVariant?.sku ?? item.product.sku,
        variantName: item.productVariant?.name ?? null,
        quantity: item.quantity,
        personalization: item.personalization,
        unitPrice: unitPrice.toFixed(3),
        lineTotal: unitPrice.times(item.quantity).toFixed(3),
        availableStock: item.productVariant?.stock ?? item.product.stock,
        image: item.product.images[0]
          ? { url: item.product.images[0].asset.url, altText: item.product.images[0].altText }
          : null,
      };
    });
    return {
      items,
      subtotal: items.reduce((sum, item) => sum.plus(item.lineTotal), new Decimal(0)).toFixed(3),
      currency: settings.defaultCurrency,
      locale: settings.defaultLocale,
      expiresAt: cart.expiresAt,
    };
  }

  async add(token: string, dto: AddCartItemDto) {
    const cart = await this.findCart(token);
    const selection = await this.resolveSelection(dto.productId, dto.variantId);
    this.validatePersonalization(dto.personalization, selection.personalizationSchema);
    const alreadyInCart = cart.items
      .filter((item) => item.productId === dto.productId && item.productVariantId === (dto.variantId ?? null))
      .reduce((sum, item) => sum + item.quantity, 0);
    if (alreadyInCart + dto.quantity > selection.stock) throw new BadRequestException("Stock insuffisant.");

    await this.prisma.$transaction([
      this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          productVariantId: dto.variantId ?? null,
          quantity: dto.quantity,
          ...(dto.personalization ? { personalization: dto.personalization as Prisma.InputJsonValue } : {}),
        },
      }),
      this.prisma.analyticsEvent.create({
        data: { type: AnalyticsEventType.ADD_TO_CART, productId: dto.productId },
      }),
    ]);
    return this.get(token);
  }

  async update(token: string, itemId: string, quantity: number) {
    const cart = await this.findCart(token);
    const item = cart.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new NotFoundException("Article de panier introuvable.");
    const stock = item.productVariant?.stock ?? item.product.stock;
    const quantityOnOtherLines = cart.items
      .filter((candidate) => candidate.id !== itemId && candidate.productId === item.productId && candidate.productVariantId === item.productVariantId)
      .reduce((sum, candidate) => sum + candidate.quantity, 0);
    if (quantityOnOtherLines + quantity > stock) throw new BadRequestException("Stock insuffisant.");
    await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    return this.get(token);
  }

  async remove(token: string, itemId: string) {
    const cart = await this.findCart(token);
    const deleted = await this.prisma.cartItem.deleteMany({ where: { id: itemId, cartId: cart.id } });
    if (deleted.count !== 1) throw new NotFoundException("Article de panier introuvable.");
    return this.get(token);
  }

  private findCart(token: string) {
    return this.prisma.cart
      .findUnique({
        where: { tokenHash: hashToken(token) },
        include: {
          items: {
            orderBy: { createdAt: "asc" },
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  sku: true,
                  basePrice: true,
                  salePrice: true,
                  stock: true,
                  status: true,
                  images: { take: 1, orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], select: { altText: true, asset: { select: { url: true } } } },
                },
              },
              productVariant: { select: { id: true, name: true, sku: true, price: true, salePrice: true, stock: true, isActive: true } },
            },
          },
        },
      })
      .then(async (cart) => {
        if (!cart) throw new NotFoundException("Panier introuvable.");
        if (cart.expiresAt <= new Date()) {
          await this.prisma.cart.delete({ where: { id: cart.id } });
          throw new GoneException("Ce panier a expiré.");
        }
        return cart;
      });
  }

  private async resolveSelection(productId: string, variantId: string | undefined) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: ProductStatus.ACTIVE, publishedAt: { lte: new Date() } },
      select: { stock: true, personalizationSchema: true, _count: { select: { variants: { where: { isActive: true } } } } },
    });
    if (!product) throw new NotFoundException("Produit indisponible.");
    if (!variantId) {
      if (product._count.variants > 0) throw new BadRequestException("Une variante doit être sélectionnée.");
      return { stock: product.stock, personalizationSchema: product.personalizationSchema };
    }
    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId, isActive: true }, select: { stock: true } });
    if (!variant) throw new BadRequestException("Variante invalide.");
    return { stock: variant.stock, personalizationSchema: product.personalizationSchema };
  }

  private validatePersonalization(personalization: Record<string, string> | undefined, schema: unknown): void {
    const schemaRecord = typeof schema === "object" && schema !== null && !Array.isArray(schema) ? schema as Record<string, unknown> : {};
    const allowedKeys = new Set(Object.keys(schemaRecord));
    if (!personalization) {
      if (Object.values(schemaRecord).some((configuration) => typeof configuration === "object" && configuration !== null && "required" in configuration && configuration.required === true)) {
        throw new BadRequestException("Les champs de personnalisation requis doivent être renseignés.");
      }
      return;
    }
    const entries = Object.entries(personalization);
    if (entries.length > 10) throw new BadRequestException("Trop de champs de personnalisation.");
    for (const [key, value] of entries) {
      const configuration = schemaRecord[key];
      const configuredMaxLength = typeof configuration === "object" && configuration !== null && "maxLength" in configuration && typeof configuration.maxLength === "number" ? Math.min(configuration.maxLength, 300) : 300;
      if (!allowedKeys.has(key) || key.length === 0 || key.length > 50 || typeof value !== "string" || value.length > configuredMaxLength) {
        throw new BadRequestException("Personnalisation invalide.");
      }
    }
    for (const [key, configuration] of Object.entries(schemaRecord)) {
      const required = typeof configuration === "object" && configuration !== null && "required" in configuration && configuration.required === true;
      if (required && !personalization[key]?.trim()) throw new BadRequestException("Les champs de personnalisation requis doivent être renseignés.");
    }
  }
}
