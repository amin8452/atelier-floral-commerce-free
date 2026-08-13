import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service.js";
import type { CreateTaxonomyDto, UpdateTaxonomyDto } from "../common/catalog/taxonomy.dto.js";

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  listPublic() {
    return this.prisma.collection.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, description: true, _count: { select: { products: true } } },
    });
  }

  listAdmin() {
    return this.prisma.collection.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });
  }

  create(dto: CreateTaxonomyDto) {
    return this.prisma.collection.create({
      data: {
        name: dto.name.trim(),
        slug: dto.slug.trim().toLowerCase(),
        description: dto.description?.trim() || null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateTaxonomyDto) {
    await this.ensureExists(id);
    return this.prisma.collection.update({ where: { id }, data: this.mapData(dto) });
  }

  async archive(id: string) {
    await this.ensureExists(id);
    return this.prisma.collection.update({ where: { id }, data: { isActive: false } });
  }

  private async ensureExists(id: string): Promise<void> {
    if (!(await this.prisma.collection.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException("Collection introuvable.");
    }
  }

  private mapData(dto: UpdateTaxonomyDto) {
    return {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.slug !== undefined ? { slug: dto.slug.trim().toLowerCase() } : {}),
      ...(dto.description !== undefined ? { description: dto.description.trim() || null } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
  }
}
