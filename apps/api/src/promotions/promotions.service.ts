import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Decimal } from "decimal.js";
import type { Prisma } from "../generated/prisma/client.js";
import { DiscountType } from "../generated/prisma/enums.js";
import { paginationMeta, type PaginationDto } from "../common/pagination/pagination.dto.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import type { CreatePromotionDto, UpdatePromotionDto } from "./promotion.dto.js";

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.promotion.findMany({ orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.promotion.count(),
    ]);
    return { items, meta: paginationMeta(query.page, query.pageSize, total) };
  }

  create(dto: CreatePromotionDto) {
    this.validate(dto.discountType, dto.discountValue, dto.startsAt, dto.endsAt);
    return this.prisma.promotion.create({ data: this.mapCreate(dto) });
  }

  async update(id: string, dto: UpdatePromotionDto) {
    const current = await this.prisma.promotion.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Promotion introuvable.");
    this.validate(dto.discountType ?? current.discountType, dto.discountValue ?? current.discountValue.toString(), dto.startsAt ?? current.startsAt ?? undefined, dto.endsAt ?? current.endsAt ?? undefined);
    return this.prisma.promotion.update({ where: { id }, data: this.mapUpdate(dto) });
  }

  async resolveForCheckout(code: string | undefined, subtotal: Decimal, tx: Prisma.TransactionClient) {
    if (!code) return null;
    const now = new Date();
    const promotion = await tx.promotion.findUnique({ where: { code: code.trim().toUpperCase() } });
    if (
      !promotion ||
      !promotion.isActive ||
      (promotion.startsAt && promotion.startsAt > now) ||
      (promotion.endsAt && promotion.endsAt < now) ||
      (promotion.usageLimit !== null && promotion.usageCount >= promotion.usageLimit) ||
      (promotion.minimumAmount && subtotal.lessThan(promotion.minimumAmount.toString()))
    ) {
      throw new BadRequestException("Code promotionnel invalide ou indisponible.");
    }
    return promotion;
  }

  private mapCreate(dto: CreatePromotionDto): Prisma.PromotionCreateInput {
    return {
      name: dto.name.trim(),
      code: dto.code.trim().toUpperCase(),
      discountType: dto.discountType,
      discountValue: dto.discountValue,
      minimumAmount: dto.minimumAmount ?? null,
      usageLimit: dto.usageLimit ?? null,
      isActive: dto.isActive ?? false,
      startsAt: dto.startsAt ?? null,
      endsAt: dto.endsAt ?? null,
    };
  }

  private mapUpdate(dto: UpdatePromotionDto): Prisma.PromotionUpdateInput {
    return {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.code !== undefined ? { code: dto.code.trim().toUpperCase() } : {}),
      ...(dto.discountType !== undefined ? { discountType: dto.discountType } : {}),
      ...(dto.discountValue !== undefined ? { discountValue: dto.discountValue } : {}),
      ...(dto.minimumAmount !== undefined ? { minimumAmount: dto.minimumAmount } : {}),
      ...(dto.usageLimit !== undefined ? { usageLimit: dto.usageLimit } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.startsAt !== undefined ? { startsAt: dto.startsAt } : {}),
      ...(dto.endsAt !== undefined ? { endsAt: dto.endsAt } : {}),
    };
  }

  private validate(type: DiscountType, value: string, startsAt?: Date, endsAt?: Date): void {
    const decimal = new Decimal(value);
    if (decimal.lessThanOrEqualTo(0) || (type === DiscountType.PERCENTAGE && decimal.greaterThan(100))) {
      throw new BadRequestException("Valeur de promotion invalide.");
    }
    if (startsAt && endsAt && startsAt >= endsAt) throw new BadRequestException("La date de fin doit suivre la date de début.");
  }
}
