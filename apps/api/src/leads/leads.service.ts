import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "../generated/prisma/client.js";
import { AdminAuditAction, AnalyticsEventType, LeadActivityType, LeadSource, LeadStatus, PreferredContactMethod, ProductStatus } from "../generated/prisma/enums.js";
import { AuditService } from "../common/audit/audit.service.js";
import { paginationMeta } from "../common/pagination/pagination.dto.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { NotificationService } from "../notifications/notification.service.js";
import type { CreateContactDto, CreateLeadDto, LeadQueryDto, UpdateLeadDto } from "./create-lead.dto.js";

type LeadInput = CreateLeadDto | CreateContactDto;

@Injectable()
export class LeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationService,
    private readonly audit: AuditService,
  ) {}

  createProductLead(dto: CreateLeadDto) {
    return this.create(dto, LeadSource.PRODUCT_FORM);
  }

  createContact(dto: CreateContactDto) {
    return this.create(dto, LeadSource.CONTACT_PAGE);
  }

  async listAdmin(query: LeadQueryDto) {
    const where: Prisma.LeadWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.search
        ? {
            OR: [
              { firstName: { contains: query.search.trim(), mode: "insensitive" } },
              { lastName: { contains: query.search.trim(), mode: "insensitive" } },
              { phone: { contains: query.search.trim() } },
              { email: { contains: query.search.trim(), mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          product: { select: { id: true, name: true, slug: true, sku: true } },
          productVariant: { select: { id: true, name: true, sku: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);
    return { items, meta: paginationMeta(query.page, query.pageSize, total) };
  }

  async getAdmin(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        product: { select: { id: true, name: true, slug: true, sku: true, basePrice: true, salePrice: true } },
        productVariant: { select: { id: true, name: true, sku: true, options: true, price: true, salePrice: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        activities: { orderBy: { createdAt: "asc" }, include: { createdBy: { select: { id: true, firstName: true, lastName: true } } } },
      },
    });
    if (!lead) throw new NotFoundException("Lead introuvable.");
    return lead;
  }

  async update(id: string, dto: UpdateLeadDto, actorId: string, ipAddress?: string) {
    const current = await this.prisma.lead.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Lead introuvable.");
    if (!dto.status && !dto.assignedToId && !dto.note?.trim()) throw new BadRequestException("Aucune modification fournie.");
    if (dto.assignedToId) {
      const assignee = await this.prisma.adminUser.findFirst({ where: { id: dto.assignedToId, isActive: true }, select: { id: true } });
      if (!assignee) throw new BadRequestException("Responsable invalide.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: {
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.assignedToId ? { assignedToId: dto.assignedToId } : {}),
        },
      });
      if (dto.status && dto.status !== current.status) {
        await tx.leadActivity.create({
          data: {
            leadId: id,
            type: dto.status === LeadStatus.CONTACTED ? LeadActivityType.CONTACTED : dto.status === LeadStatus.CONVERTED ? LeadActivityType.CONVERTED : LeadActivityType.STATUS_CHANGED,
            metadata: { from: current.status, to: dto.status },
            createdById: actorId,
          },
        });
      }
      if (dto.note?.trim()) {
        await tx.leadActivity.create({ data: { leadId: id, type: LeadActivityType.NOTE_ADDED, metadata: { note: dto.note.trim() }, createdById: actorId } });
      }
    });
    if (dto.status && dto.status !== current.status) {
      await this.audit.record({ actorId, action: AdminAuditAction.LEAD_STATUS_CHANGED, resourceType: "Lead", resourceId: id, metadata: { from: current.status, to: dto.status }, ipAddress });
    }
    if (dto.note?.trim()) {
      await this.audit.record({ actorId, action: AdminAuditAction.LEAD_NOTE_ADDED, resourceType: "Lead", resourceId: id, ipAddress });
    }
    return this.getAdmin(id);
  }

  async markWhatsAppOpened(id: string, actorId: string) {
    if (!(await this.prisma.lead.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException("Lead introuvable.");
    await this.prisma.leadActivity.create({ data: { leadId: id, type: LeadActivityType.WHATSAPP_OPENED, createdById: actorId } });
    return { success: true };
  }

  private async create(dto: LeadInput, source: LeadSource) {
    if (!dto.consentToContact) throw new BadRequestException("Le consentement de contact est requis.");
    if (dto.preferredContactMethod === PreferredContactMethod.EMAIL && !dto.email) {
      throw new BadRequestException("L'email est requis pour ce moyen de contact.");
    }
    const productId = "productId" in dto ? dto.productId : undefined;
    const variantId = "productVariantId" in dto ? dto.productVariantId : undefined;
    if (variantId && !productId) throw new BadRequestException("Le produit est requis avec une variante.");
    const selection = productId ? await this.validateProductSelection(productId, variantId) : null;

    const lead = await this.prisma.$transaction(async (tx) => {
      const created = await tx.lead.create({
        data: {
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          phone: dto.phone.trim(),
          email: dto.email?.trim().toLowerCase() || null,
          subject: "subject" in dto ? dto.subject.trim() : null,
          message: dto.message?.trim() || null,
          preferredContactMethod: dto.preferredContactMethod,
          consentToContact: true,
          consentAt: new Date(),
          consentPolicyVersion: this.config.getOrThrow<string>("CONSENT_POLICY_VERSION"),
          productId: productId ?? null,
          productVariantId: variantId ?? null,
          quantity: "quantity" in dto ? dto.quantity : 1,
          source,
          status: LeadStatus.NEW,
          activities: { create: { type: LeadActivityType.LEAD_CREATED } },
        },
        include: { product: true, productVariant: true },
      });
      await tx.analyticsEvent.create({ data: { type: AnalyticsEventType.LEAD_CREATED, productId: productId ?? null } });
      return created;
    });

    const emailSent = await this.notifications.notifySellerOfLead({
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      phone: lead.phone,
      email: lead.email,
      message: lead.message,
      preferredContactMethod: lead.preferredContactMethod,
      quantity: lead.quantity,
      productName: lead.product?.name ?? null,
      sku: lead.productVariant?.sku ?? lead.product?.sku ?? null,
      variantName: lead.productVariant?.name ?? null,
    });
    if (emailSent) await this.prisma.leadActivity.create({ data: { leadId: lead.id, type: LeadActivityType.EMAIL_SENT } });
    return { id: lead.id, createdAt: lead.createdAt, status: lead.status, notificationSent: emailSent, product: selection };
  }

  private async validateProductSelection(productId: string, variantId: string | undefined) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: ProductStatus.ACTIVE, publishedAt: { lte: new Date() } },
      select: { id: true, name: true },
    });
    if (!product) throw new BadRequestException("Produit indisponible.");
    if (variantId) {
      const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, productId, isActive: true }, select: { id: true, name: true } });
      if (!variant) throw new BadRequestException("Variante invalide.");
      return { ...product, variant };
    }
    return product;
  }
}
