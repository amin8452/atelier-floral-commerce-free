import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import { LeadSource, LeadStatus, PreferredContactMethod, ProductStatus } from "../src/generated/prisma/enums.js";
import type { AuditService } from "../src/common/audit/audit.service.js";
import type { PrismaService } from "../src/common/prisma/prisma.service.js";
import { LeadsService } from "../src/leads/leads.service.js";
import type { NotificationService } from "../src/notifications/notification.service.js";
import { ProductsService } from "../src/products/products.service.js";

describe("product administration", () => {
  it("creates a validated draft and records an admin audit", async () => {
    const create = vi.fn().mockResolvedValue({ id: "product-id" });
    const detail = { id: "product-id", variants: [], images: [], collections: [] };
    const tx = { product: { create } };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      product: { findUnique: vi.fn().mockResolvedValue(detail) },
    } as unknown as PrismaService;
    const record = vi.fn();
    const service = new ProductsService(prisma, { record } as unknown as AuditService);
    await service.create({
      name: "Pendentif floral",
      slug: "pendentif-floral",
      basePrice: "45.000",
      stock: 3,
      status: ProductStatus.DRAFT,
    }, "admin-id");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ name: "Pendentif floral", status: ProductStatus.DRAFT, stock: 3 }) }));
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ actorId: "admin-id", resourceId: "product-id" }));
  });

  it("clears nullable product fields without crashing", async () => {
    const update = vi.fn().mockResolvedValue({ id: "product-id" });
    const detail = { id: "product-id", variants: [], images: [], collections: [] };
    const tx = { product: { update } };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      product: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({
            id: "product-id",
            status: ProductStatus.DRAFT,
            name: "Pendentif floral",
            shortDescription: null,
            description: null,
            basePrice: "45.000",
            salePrice: null,
            stock: 3,
            publishedAt: null,
            deletionScheduledFor: null,
            variants: [],
          })
          .mockResolvedValueOnce(detail),
      },
    } as unknown as PrismaService;
    const service = new ProductsService(prisma, { record: vi.fn() } as unknown as AuditService);

    await expect(service.update("product-id", {
      sku: null,
      shortDescription: null,
      description: null,
      metaTitle: null,
      metaDescription: null,
    }, "admin-id")).resolves.toEqual(detail);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sku: null, shortDescription: null, description: null, metaTitle: null, metaDescription: null }),
    }));
  });

  it("keeps an already published product valid when it is edited", async () => {
    const transaction = vi.fn();
    const prisma = {
      $transaction: transaction,
      product: {
        findUnique: vi.fn().mockResolvedValue({
          id: "product-id",
          status: ProductStatus.ACTIVE,
          name: "Pendentif floral",
          shortDescription: "Une pièce réalisée à la main.",
          description: null,
          basePrice: "45.000",
          salePrice: null,
          stock: 3,
          publishedAt: new Date(),
          deletionScheduledFor: null,
          variants: [],
        }),
      },
    } as unknown as PrismaService;
    const service = new ProductsService(prisma, { record: vi.fn() } as unknown as AuditService);

    await expect(service.update("product-id", { basePrice: "0" }, "admin-id"))
      .rejects.toThrow("Impossible de publier ce produit");
    expect(transaction).not.toHaveBeenCalled();
  });
});

describe("lead workflow", () => {
  it("persists the lead, activity and internal analytics before notifying", async () => {
    const createdAt = new Date();
    const createLead = vi.fn().mockResolvedValue({
      id: "lead-id", firstName: "Nadia", lastName: "B", phone: "+21620000000", email: "nadia@example.test",
      message: "Bonjour", preferredContactMethod: PreferredContactMethod.EMAIL, quantity: 1, createdAt,
      status: LeadStatus.NEW, product: null, productVariant: null,
    });
    const createEvent = vi.fn().mockResolvedValue({});
    const tx = { lead: { create: createLead }, analyticsEvent: { create: createEvent } };
    const emailActivity = vi.fn().mockResolvedValue({});
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
      leadActivity: { create: emailActivity },
    } as unknown as PrismaService;
    const config = { getOrThrow: vi.fn().mockReturnValue("2026-01") } as unknown as ConfigService;
    const notify = vi.fn().mockResolvedValue(true);
    const service = new LeadsService(prisma, config, { notifySellerOfLead: notify } as unknown as NotificationService, { record: vi.fn() } as unknown as AuditService);
    const result = await service.createContact({
      firstName: "Nadia", lastName: "B", phone: "+21620000000", email: "nadia@example.test",
      subject: "Question", message: "Bonjour", preferredContactMethod: PreferredContactMethod.EMAIL, consentToContact: true,
    });
    expect(createLead).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ source: LeadSource.CONTACT_PAGE, status: LeadStatus.NEW, consentPolicyVersion: "2026-01" }) }));
    expect(createEvent).toHaveBeenCalled();
    expect(notify).toHaveBeenCalled();
    expect(emailActivity).toHaveBeenCalled();
    expect(result.notificationSent).toBe(true);
  });
});
