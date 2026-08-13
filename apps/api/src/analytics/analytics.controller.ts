import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { UserRole } from "../generated/prisma/enums.js";
import { AdminOriginGuard } from "../auth/admin-origin.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { CreateAnalyticsEventDto, DashboardQueryDto, ProductPerformanceQueryDto } from "./analytics.dto.js";
import { AnalyticsService } from "./analytics.service.js";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post("events")
  @UseGuards(AdminOriginGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  record(@Body() dto: CreateAnalyticsEventDto) { return this.analytics.recordPublic(dto); }

  @Get("admin/dashboard")
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ORDER_MANAGER, UserRole.PRODUCT_MANAGER, UserRole.SUPPORT)
  dashboard(@Query() query: DashboardQueryDto) { return this.analytics.dashboard(query.days); }

  @Get("admin/products")
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRODUCT_MANAGER)
  performance(@Query() query: ProductPerformanceQueryDto) { return this.analytics.productPerformance(query); }
}
