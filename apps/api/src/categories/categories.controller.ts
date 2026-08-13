import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { UserRole } from "../generated/prisma/enums.js";
import { AdminOriginGuard } from "../auth/admin-origin.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { CreateTaxonomyDto, UpdateTaxonomyDto } from "../common/catalog/taxonomy.dto.js";
import { CategoriesService } from "./categories.service.js";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get() listPublic() { return this.categories.listPublic(); }

  @Get("admin")
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRODUCT_MANAGER)
  listAdmin() { return this.categories.listAdmin(); }

  @Post("admin")
  @UseGuards(SessionAuthGuard, RolesGuard, AdminOriginGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRODUCT_MANAGER)
  create(@Body() dto: CreateTaxonomyDto) { return this.categories.create(dto); }

  @Patch("admin/:id")
  @UseGuards(SessionAuthGuard, RolesGuard, AdminOriginGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRODUCT_MANAGER)
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateTaxonomyDto) { return this.categories.update(id, dto); }

  @Delete("admin/:id")
  @UseGuards(SessionAuthGuard, RolesGuard, AdminOriginGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRODUCT_MANAGER)
  archive(@Param("id", ParseUUIDPipe) id: string) { return this.categories.archive(id); }
}
