import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "../generated/prisma/enums.js";
import { AdminOriginGuard } from "../auth/admin-origin.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { PaginationDto } from "../common/pagination/pagination.dto.js";
import { CreatePromotionDto, UpdatePromotionDto } from "./promotion.dto.js";
import { PromotionsService } from "./promotions.service.js";

@Controller("promotions/admin")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}
  @Get() list(@Query() query: PaginationDto) { return this.promotions.list(query); }
  @Post() @UseGuards(AdminOriginGuard) create(@Body() dto: CreatePromotionDto) { return this.promotions.create(dto); }
  @Patch(":id") @UseGuards(AdminOriginGuard) update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdatePromotionDto) { return this.promotions.update(id, dto); }
}
