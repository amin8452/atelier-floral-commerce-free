import { ConflictException } from "@nestjs/common";
import { Decimal } from "decimal.js";
import { describe, expect, it, vi } from "vitest";
import { FulfillmentStatus, PaymentMethod, PaymentStatus, ProductStatus } from "../src/generated/prisma/enums.js";
import type { AuditService } from "../src/common/audit/audit.service.js";
import type { PrismaService } from "../src/common/prisma/prisma.service.js";
import type { PaymentsService } from "../src/payments/payments.service.js";
import type { PromotionsService } from "../src/promotions/promotions.service.js";
import { isFulfillmentTransitionAllowed, isPaymentTransitionAllowed, OrdersService } from "../src/orders/orders.service.js";
import { completedPaymentStatus, orderCompletionError } from "../src/orders/order-completion.js";

describe("order workflow", () => {
  it("allows only explicit payment and fulfillment transitions", () => {
    expect(isPaymentTransitionAllowed(PaymentStatus.PENDING, PaymentStatus.PAID)).toBe(true);
    expect(isPaymentTransitionAllowed(PaymentStatus.PAID, PaymentStatus.PENDING)).toBe(false);
    expect(isFulfillmentTransitionAllowed(FulfillmentStatus.NEW, FulfillmentStatus.PROCESSING)).toBe(true);
    expect(isFulfillmentTransitionAllowed(FulfillmentStatus.DELIVERED, FulfillmentStatus.CANCELLED)).toBe(false);
  });

  it("completes a cash-on-delivery order and confirms its payment", () => {
    const state = {
      fulfillmentStatus: FulfillmentStatus.NEW,
      paymentStatus: PaymentStatus.PENDING,
      paymentMethods: [PaymentMethod.CASH_ON_DELIVERY],
    };

    expect(orderCompletionError(state)).toBeNull();
    expect(completedPaymentStatus(state)).toBe(PaymentStatus.PAID);
  });

  it("does not confirm an unverified online payment", () => {
    expect(orderCompletionError({
      fulfillmentStatus: FulfillmentStatus.PROCESSING,
      paymentStatus: PaymentStatus.PENDING,
      paymentMethods: [PaymentMethod.ONLINE],
    })).toContain("fournisseur");
  });

  it("persists quick completion, payment confirmation, history and audit atomically", async () => {
    const current = {
      id: "order-id",
      fulfillmentStatus: FulfillmentStatus.NEW,
      paymentStatus: PaymentStatus.PENDING,
      payments: [{ method: PaymentMethod.CASH_ON_DELIVERY }],
    };
    const completed = { ...current, fulfillmentStatus: FulfillmentStatus.DELIVERED, paymentStatus: PaymentStatus.PAID };
    const updateOrder = vi.fn().mockResolvedValue(completed);
    const updatePayments = vi.fn().mockResolvedValue({ count: 1 });
    const createActivity = vi.fn().mockResolvedValue({ id: "activity-id" });
    const tx = {
      order: { findUnique: vi.fn().mockResolvedValue(current), update: updateOrder },
      payment: { updateMany: updatePayments },
      orderActivity: { create: createActivity },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;
    const record = vi.fn().mockResolvedValue(undefined);
    const service = new OrdersService(
      prisma,
      {} as PromotionsService,
      {} as PaymentsService,
      { record } as unknown as AuditService,
    );

    await expect(service.complete("order-id", "admin-id")).resolves.toMatchObject({
      fulfillmentStatus: FulfillmentStatus.DELIVERED,
      paymentStatus: PaymentStatus.PAID,
    });
    expect(updateOrder).toHaveBeenCalledWith(expect.objectContaining({ data: { fulfillmentStatus: FulfillmentStatus.DELIVERED, paymentStatus: PaymentStatus.PAID } }));
    expect(updatePayments).toHaveBeenCalled();
    expect(createActivity).toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ actorId: "admin-id", resourceId: "order-id" }));
  });

  it("rejects checkout atomically when the conditional stock decrement loses a race", async () => {
    const productId = "11111111-1111-4111-8111-111111111111";
    const cart = {
      id: "cart", expiresAt: new Date(Date.now() + 60_000),
      items: [{
        id: "line", productId, productVariantId: null, quantity: 1, personalization: null,
        productVariant: null,
        product: { id: productId, name: "Création", sku: "SKU", status: ProductStatus.ACTIVE, publishedAt: new Date(Date.now() - 1000), basePrice: new Decimal(25), salePrice: null, stock: 1, variants: [] },
      }],
    };
    const tx = {
      order: { findUnique: vi.fn().mockResolvedValue(null) },
      cart: { findUnique: vi.fn().mockResolvedValue(cart) },
      storeSettings: { findUniqueOrThrow: vi.fn().mockResolvedValue({ codEnabled: true, defaultCurrency: "TND", shippingEnabled: false, shippingFlatRate: new Decimal(0), taxRate: new Decimal(0) }) },
      product: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    const orderLookup = vi.fn().mockResolvedValue(null);
    const prisma = {
      order: { findUnique: orderLookup },
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    } as unknown as PrismaService;
    const promotions = { resolveForCheckout: vi.fn().mockResolvedValue(null) } as unknown as PromotionsService;
    const payments = {} as PaymentsService;
    const audit = {} as AuditService;
    const service = new OrdersService(prisma, promotions, payments, audit);
    await expect(service.checkout("opaque-cart-token", "idempotency-key-123456", {
      customer: { firstName: "A", lastName: "B", phone: "+21620000000" },
      shippingAddress: { line1: "Rue", city: "Tunis", country: "TN" },
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.product.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ stock: { gte: 1 } }) }));
  });
});
