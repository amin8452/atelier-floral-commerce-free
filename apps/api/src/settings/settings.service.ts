import { BadRequestException, Injectable, type OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AdminAuditAction } from "../generated/prisma/enums.js";
import { AuditService } from "../common/audit/audit.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { getStoreDefaults } from "../config/store.config.js";
import type { UpdateSettingsDto } from "./update-settings.dto.js";

const SETTINGS_ID = "store";

@Injectable()
export class SettingsService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const defaults = getStoreDefaults(this.config);
    await this.prisma.storeSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID, ...defaults },
    });
  }

  publicSettings() {
    return this.prisma.storeSettings.findUnique({
      where: { id: SETTINGS_ID },
      select: {
        storeName: true,
        storeEmail: true,
        supportEmail: true,
        defaultCurrency: true,
        defaultLocale: true,
        whatsappNumber: true,
        address: true,
        city: true,
        country: true,
        shippingEnabled: true,
        shippingFlatRate: true,
        codEnabled: true,
        onlinePaymentEnabled: true,
        instagramUrl: true,
        facebookUrl: true,
        heroImageUrl: true,
        storyImageUrl: true,
      },
    });
  }

  getAdminSettings() {
    return this.prisma.storeSettings.findUniqueOrThrow({ where: { id: SETTINGS_ID } });
  }

  async update(dto: UpdateSettingsDto, actorId: string, ipAddress?: string) {
    if (dto.onlinePaymentEnabled === true) {
      throw new BadRequestException("Configurez d’abord un fournisseur de paiement en ligne vérifié.");
    }
    const settings = await this.prisma.storeSettings.update({
      where: { id: SETTINGS_ID },
      data: {
        ...(dto.storeName !== undefined ? { storeName: dto.storeName.trim() } : {}),
        ...(dto.storeEmail !== undefined ? { storeEmail: dto.storeEmail?.trim().toLowerCase() || null } : {}),
        ...(dto.supportEmail !== undefined ? { supportEmail: dto.supportEmail?.trim().toLowerCase() || null } : {}),
        ...(dto.whatsappNumber !== undefined ? { whatsappNumber: dto.whatsappNumber?.trim() || null } : {}),
        ...(dto.defaultCurrency !== undefined ? { defaultCurrency: dto.defaultCurrency.toUpperCase() } : {}),
        ...(dto.defaultLocale !== undefined ? { defaultLocale: dto.defaultLocale.trim() } : {}),
        ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
        ...(dto.city !== undefined ? { city: dto.city?.trim() || null } : {}),
        ...(dto.country !== undefined ? { country: dto.country?.toUpperCase() || null } : {}),
        ...(dto.shippingEnabled !== undefined ? { shippingEnabled: dto.shippingEnabled } : {}),
        ...(dto.shippingFlatRate !== undefined ? { shippingFlatRate: dto.shippingFlatRate } : {}),
        ...(dto.taxRate !== undefined ? { taxRate: dto.taxRate } : {}),
        ...(dto.codEnabled !== undefined ? { codEnabled: dto.codEnabled } : {}),
        ...(dto.onlinePaymentEnabled !== undefined ? { onlinePaymentEnabled: dto.onlinePaymentEnabled } : {}),
        ...(dto.instagramUrl !== undefined ? { instagramUrl: dto.instagramUrl?.trim() || null } : {}),
        ...(dto.facebookUrl !== undefined ? { facebookUrl: dto.facebookUrl?.trim() || null } : {}),
        ...(dto.heroImageUrl !== undefined ? { heroImageUrl: dto.heroImageUrl?.trim() || null } : {}),
        ...(dto.storyImageUrl !== undefined ? { storyImageUrl: dto.storyImageUrl?.trim() || null } : {}),
      },
    });
    await this.audit.record({
      actorId,
      action: AdminAuditAction.SETTINGS_UPDATED,
      resourceType: "StoreSettings",
      resourceId: SETTINGS_ID,
      ipAddress,
    });
    return settings;
  }
}
