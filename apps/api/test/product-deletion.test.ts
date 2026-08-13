import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../src/common/audit/audit.service.js";
import type { PrismaService } from "../src/common/prisma/prisma.service.js";
import { ProductStatus } from "../src/generated/prisma/enums.js";
import type { NotificationService } from "../src/notifications/notification.service.js";
import { deletionDeadline, ProductDeletionService } from "../src/products/product-deletion.service.js";

describe("product deletion grace period", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps a product recoverable for exactly 24 hours", () => {
    const requestedAt = new Date("2026-08-13T12:00:00.000Z");
    expect(deletionDeadline(requestedAt).toISOString()).toBe("2026-08-14T12:00:00.000Z");
  });

  it("schedules deletion, audits it and notifies the administrator", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-13T12:00:00.000Z"));
    const findUnique = vi.fn().mockResolvedValue({
      id: "product-id",
      name: "Bouquet test",
      status: ProductStatus.ARCHIVED,
      deletionRequestedAt: null,
      deletionScheduledFor: null,
    });
    const update = vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: "product-id", name: "Bouquet test", status: ProductStatus.ARCHIVED, ...data }));
    const record = vi.fn().mockResolvedValue(undefined);
    const notifyAdminOfProductDeletion = vi.fn().mockResolvedValue(true);
    const service = new ProductDeletionService(
      { product: { findUnique, update } } as unknown as PrismaService,
      { record } as unknown as AuditService,
      { notifyAdminOfProductDeletion } as unknown as NotificationService,
    );

    const result = await service.schedule("product-id", "admin-id", "127.0.0.1");

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        deletionRequestedAt: new Date("2026-08-13T12:00:00.000Z"),
        deletionScheduledFor: new Date("2026-08-14T12:00:00.000Z"),
        deletionRequestedById: "admin-id",
      }),
    }));
    expect(record).toHaveBeenCalledOnce();
    expect(notifyAdminOfProductDeletion).toHaveBeenCalledOnce();
    expect(result.notificationSent).toBe(true);
  });

  it("purges an expired product while preserving business history", async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const deleteProduct = vi.fn().mockResolvedValue({ id: "product-id" });
    const transactionClient = {
      $queryRaw: vi.fn().mockResolvedValue([{ locked: true }]),
      product: {
        findFirst: vi.fn().mockResolvedValue({
          id: "product-id",
          name: "Bouquet expiré",
          deletionScheduledFor: new Date("2026-08-14T12:00:00.000Z"),
          _count: { cartItems: 1, orderItems: 1, leads: 1, analytics: 0 },
        }),
        delete: deleteProduct,
      },
      cartItem: { deleteMany },
      orderItem: { updateMany },
      lead: { updateMany },
      productImage: { deleteMany },
      adminAudit: { create: vi.fn().mockResolvedValue({ id: "audit-id" }) },
    };
    const prisma = {
      product: { findMany: vi.fn().mockResolvedValue([{ id: "product-id" }]) },
      $transaction: vi.fn().mockImplementation((operation) => operation(transactionClient)),
    } as unknown as PrismaService;
    const record = vi.fn().mockResolvedValue(undefined);
    const service = new ProductDeletionService(
      prisma,
      { record } as unknown as AuditService,
      { notifyAdminOfProductDeletion: vi.fn() } as unknown as NotificationService,
    );

    await expect(service.purgeExpired(new Date("2026-08-14T12:01:00.000Z"))).resolves.toBe(1);
    expect(deleteProduct).toHaveBeenCalledWith({ where: { id: "product-id" } });
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(transactionClient.adminAudit.create).toHaveBeenCalledWith({ data: expect.objectContaining({ resourceId: "product-id" }) });
    expect(record).not.toHaveBeenCalled();
  });
});
