import { BadRequestException, Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { UserRole } from "../generated/prisma/enums.js";
import { AdminOriginGuard } from "../auth/admin-origin.guard.js";
import { CurrentAdmin } from "../auth/current-admin.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import type { AuthenticatedAdmin } from "../auth/auth.types.js";
import { requireCartToken } from "../carts/cart-token.js";
import { PaginationDto } from "../common/pagination/pagination.dto.js";
import { CheckoutDto, UpdateOrderStatusDto } from "./order.dto.js";
import { OrdersService } from "./orders.service.js";

@Controller("orders")
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post("checkout")
  @UseGuards(AdminOriginGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  checkout(
    @Headers("x-cart-token") cartToken: string | undefined,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() dto: CheckoutDto,
  ) {
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 180) {
      throw new BadRequestException("Clé d’idempotence invalide.");
    }
    return this.orders.checkout(requireCartToken(cartToken), idempotencyKey, dto);
  }

  @Get("admin")
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORDER_MANAGER)
  listAdmin(@Query() query: PaginationDto) { return this.orders.listAdmin(query); }

  @Get("admin/:id")
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORDER_MANAGER)
  getAdmin(@Param("id", ParseUUIDPipe) id: string) { return this.orders.getAdmin(id); }

  @Patch("admin/:id/status")
  @UseGuards(SessionAuthGuard, RolesGuard, AdminOriginGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORDER_MANAGER)
  updateStatus(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateOrderStatusDto, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() request: Request) {
    return this.orders.updateStatus(id, dto, admin.id, request.ip);
  }

  @Post("admin/:id/complete")
  @UseGuards(SessionAuthGuard, RolesGuard, AdminOriginGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORDER_MANAGER)
  complete(@Param("id", ParseUUIDPipe) id: string, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() request: Request) {
    return this.orders.complete(id, admin.id, request.ip);
  }
}
