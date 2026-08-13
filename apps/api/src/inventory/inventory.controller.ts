import { Body, Controller, Get, Patch, Query, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { UserRole } from "../generated/prisma/enums.js";
import { AdminOriginGuard } from "../auth/admin-origin.guard.js";
import { CurrentAdmin } from "../auth/current-admin.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import type { AuthenticatedAdmin } from "../auth/auth.types.js";
import { InventoryQueryDto, SetStockDto } from "./inventory.dto.js";
import { InventoryService } from "./inventory.service.js";

@Controller("inventory/admin")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRODUCT_MANAGER)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list(@Query() query: InventoryQueryDto) { return this.inventory.list(query); }

  @Patch("stock")
  @UseGuards(AdminOriginGuard)
  setStock(@Body() dto: SetStockDto, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() request: Request) {
    return this.inventory.setStock(dto, admin.id, request.ip);
  }
}
