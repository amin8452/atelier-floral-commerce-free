import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { UserRole } from "../generated/prisma/enums.js";
import { AdminOriginGuard } from "../auth/admin-origin.guard.js";
import { CurrentAdmin } from "../auth/current-admin.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import type { AuthenticatedAdmin } from "../auth/auth.types.js";
import { AdminProductQueryDto, CreateProductDto, ProductQueryDto, UpdateProductDto } from "./product.dto.js";
import { ProductsService } from "./products.service.js";
import { ProductDeletionService } from "./product-deletion.service.js";

@Controller("products")
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly deletion: ProductDeletionService,
  ) {}

  @Get() list(@Query() query: ProductQueryDto) { return this.products.listActive(query); }

  @Get("admin")
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRODUCT_MANAGER)
  listAdmin(@Query() query: AdminProductQueryDto) { return this.products.listAdmin(query); }

  @Get("admin/:id")
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRODUCT_MANAGER)
  getAdmin(@Param("id", ParseUUIDPipe) id: string) { return this.products.getAdmin(id); }

  @Post("admin")
  @UseGuards(SessionAuthGuard, RolesGuard, AdminOriginGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRODUCT_MANAGER)
  create(@Body() dto: CreateProductDto, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() request: Request) {
    return this.products.create(dto, admin.id, request.ip);
  }

  @Patch("admin/:id")
  @UseGuards(SessionAuthGuard, RolesGuard, AdminOriginGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRODUCT_MANAGER)
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() request: Request) {
    return this.products.update(id, dto, admin.id, request.ip);
  }

  @Post("admin/:id/duplicate")
  @UseGuards(SessionAuthGuard, RolesGuard, AdminOriginGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRODUCT_MANAGER)
  duplicate(@Param("id", ParseUUIDPipe) id: string, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() request: Request) {
    return this.products.duplicate(id, admin.id, request.ip);
  }

  @Delete("admin/:id/deletion")
  @UseGuards(SessionAuthGuard, RolesGuard, AdminOriginGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  scheduleDeletion(@Param("id", ParseUUIDPipe) id: string, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() request: Request) {
    return this.deletion.schedule(id, admin.id, request.ip);
  }

  @Post("admin/:id/deletion/cancel")
  @UseGuards(SessionAuthGuard, RolesGuard, AdminOriginGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  cancelDeletion(@Param("id", ParseUUIDPipe) id: string, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() request: Request) {
    return this.deletion.cancel(id, admin.id, request.ip);
  }

  @Delete("admin/:id")
  @UseGuards(SessionAuthGuard, RolesGuard, AdminOriginGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRODUCT_MANAGER)
  archive(@Param("id", ParseUUIDPipe) id: string, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() request: Request) {
    return this.products.archive(id, admin.id, request.ip);
  }

  @Get(":slug") getBySlug(@Param("slug") slug: string) { return this.products.bySlug(slug); }
}
