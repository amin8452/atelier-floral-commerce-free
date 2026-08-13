import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AdminAuditAction } from "../generated/prisma/enums.js";
import { AuditService } from "../common/audit/audit.service.js";
import { paginationMeta } from "../common/pagination/pagination.dto.js";
import type { PaginationDto } from "../common/pagination/pagination.dto.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import type { UploadMediaDto } from "./media.dto.js";
import { STORAGE_PROVIDER, type StorageProvider } from "./storage/storage-provider.js";

const IMAGE_FORMATS = {
  "image/jpeg": { extension: ".jpg", valid: (buffer: Buffer) => buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  "image/png": { extension: ".png", valid: (buffer: Buffer) => buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  "image/webp": { extension: ".webp", valid: (buffer: Buffer) => buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP" },
  "image/avif": { extension: ".avif", valid: (buffer: Buffer) => buffer.subarray(4, 12).toString().startsWith("ftypavi") },
} as const;

type SupportedMime = keyof typeof IMAGE_FORMATS;

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async upload(file: Express.Multer.File | undefined, dto: UploadMediaDto, actorId: string, maxBytes: number, ipAddress?: string) {
    if (!file) throw new BadRequestException("Le fichier image est requis.");
    if (file.size > maxBytes) throw new BadRequestException("Le fichier dépasse la taille autorisée.");
    if (!(file.mimetype in IMAGE_FORMATS)) throw new BadRequestException("Format d'image non autorisé.");
    const format = IMAGE_FORMATS[file.mimetype as SupportedMime];
    const suppliedExtension = extname(file.originalname).toLowerCase();
    if (suppliedExtension && suppliedExtension !== format.extension && !(format.extension === ".jpg" && suppliedExtension === ".jpeg")) {
      throw new BadRequestException("L'extension ne correspond pas au type MIME.");
    }
    if (!format.valid(file.buffer)) throw new BadRequestException("Le contenu du fichier ne correspond pas à une image valide.");

    const now = new Date();
    const key = `media/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}${format.extension}`;
    const stored = await this.storage.save(key, file.buffer, file.mimetype);
    let asset;
    try {
      asset = await this.prisma.mediaAsset.create({
        data: {
          storageKey: stored.key,
          url: stored.url,
          mimeType: file.mimetype,
          extension: format.extension,
          size: file.size,
          altText: dto.altText.trim(),
          uploadedById: actorId,
        },
      });
    } catch (error) {
      await this.storage.delete(stored.key);
      throw error;
    }
    await this.audit.record({ actorId, action: AdminAuditAction.MEDIA_UPLOADED, resourceType: "MediaAsset", resourceId: asset.id, ipAddress });
    return asset;
  }

  async list(query: PaginationDto) {
    const [items, total, settings] = await this.prisma.$transaction([
      this.prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, include: { _count: { select: { productImages: true } } } }),
      this.prisma.mediaAsset.count(),
      this.prisma.storeSettings.findUnique({ where: { id: "store" }, select: { heroImageUrl: true, storyImageUrl: true } }),
    ]);
    const storeImages = new Set([settings?.heroImageUrl, settings?.storyImageUrl].filter(Boolean));
    return { items: items.map((item) => ({ ...item, usedByStore: storeImages.has(item.url) })), meta: paginationMeta(query.page, query.pageSize, total) };
  }

  async delete(id: string, actorId: string, ipAddress?: string): Promise<{ success: true }> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id }, include: { _count: { select: { productImages: true } } } });
    if (!asset) throw new NotFoundException("Média introuvable.");
    if (asset._count.productImages > 0) throw new ConflictException("Ce média est utilisé par un produit.");
    const storeUsage = await this.prisma.storeSettings.count({
      where: { OR: [{ heroImageUrl: asset.url }, { storyImageUrl: asset.url }] },
    });
    if (storeUsage > 0) throw new ConflictException("Ce média est utilisé dans les paramètres de la boutique.");
    await this.storage.delete(asset.storageKey);
    await this.prisma.mediaAsset.delete({ where: { id } });
    await this.audit.record({ actorId, action: AdminAuditAction.MEDIA_DELETED, resourceType: "MediaAsset", resourceId: id, ipAddress });
    return { success: true };
  }
}
