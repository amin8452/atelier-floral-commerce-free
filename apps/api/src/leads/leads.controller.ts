import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { UserRole } from "../generated/prisma/enums.js";
import { AdminOriginGuard } from "../auth/admin-origin.guard.js";
import { CurrentAdmin } from "../auth/current-admin.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import type { AuthenticatedAdmin } from "../auth/auth.types.js";
import { CreateContactDto, CreateLeadDto, LeadQueryDto, UpdateLeadDto } from "./create-lead.dto.js";
import { LeadsService } from "./leads.service.js";

@Controller("leads")
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  @UseGuards(AdminOriginGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000, blockDuration: 60_000 } })
  create(@Body() dto: CreateLeadDto) { return this.leads.createProductLead(dto); }

  @Post("contact")
  @UseGuards(AdminOriginGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000, blockDuration: 60_000 } })
  contact(@Body() dto: CreateContactDto) { return this.leads.createContact(dto); }

  @Get("admin")
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  listAdmin(@Query() query: LeadQueryDto) { return this.leads.listAdmin(query); }

  @Get("admin/:id")
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  getAdmin(@Param("id", ParseUUIDPipe) id: string) { return this.leads.getAdmin(id); }

  @Patch("admin/:id")
  @UseGuards(SessionAuthGuard, RolesGuard, AdminOriginGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateLeadDto, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() request: Request) {
    return this.leads.update(id, dto, admin.id, request.ip);
  }

  @Post("admin/:id/whatsapp-opened")
  @UseGuards(SessionAuthGuard, RolesGuard, AdminOriginGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  markWhatsAppOpened(@Param("id", ParseUUIDPipe) id: string, @CurrentAdmin() admin: AuthenticatedAdmin) {
    return this.leads.markWhatsAppOpened(id, admin.id);
  }
}
