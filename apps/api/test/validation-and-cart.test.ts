import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../src/common/prisma/prisma.service.js";
import { CartsService } from "../src/carts/carts.service.js";
import { CreateLeadDto } from "../src/leads/create-lead.dto.js";
import { InventoryQueryDto } from "../src/inventory/inventory.dto.js";

describe("lead validation", () => {
  it("rejects malformed contact data and unknown expectations", async () => {
    const dto = plainToInstance(CreateLeadDto, { firstName: "", lastName: "", phone: "abc", quantity: 0, preferredContactMethod: "EMAIL", consentToContact: false });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.length).toBeGreaterThanOrEqual(4);
  });
});

describe("query transformation", () => {
  it("does not interpret the string false as true", () => {
    expect(plainToInstance(InventoryQueryDto, { lowStockOnly: "false" }).lowStockOnly).toBe(false);
  });
});

describe("cart stock", () => {
  it("checks cumulative quantities across multiple cart lines", async () => {
    const cart = {
      id: "cart-id", expiresAt: new Date(Date.now() + 60_000),
      items: [{ id: "line-1", productId: "11111111-1111-4111-8111-111111111111", productVariantId: null, quantity: 4, product: {}, productVariant: null }],
    };
    const prisma = {
      cart: { findUnique: vi.fn().mockResolvedValue(cart), delete: vi.fn() },
      product: { findFirst: vi.fn().mockResolvedValue({ stock: 5, _count: { variants: 0 } }) },
      productVariant: { findFirst: vi.fn() },
      cartItem: { create: vi.fn() },
      analyticsEvent: { create: vi.fn() },
      $transaction: vi.fn(),
    } as unknown as PrismaService;
    const config = { getOrThrow: vi.fn().mockReturnValue(30) } as unknown as ConfigService;
    const service = new CartsService(prisma, config);
    await expect(service.add("opaque-token-with-sufficient-length", {
      productId: "11111111-1111-4111-8111-111111111111",
      quantity: 2,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
