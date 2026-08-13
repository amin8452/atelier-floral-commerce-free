import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { UserRole } from "../generated/prisma/enums.js";
import { AdminOriginGuard } from "../auth/admin-origin.guard.js";
import { CurrentAdmin } from "../auth/current-admin.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import type { AuthenticatedAdmin } from "../auth/auth.types.js";
import { SettingsService } from "./settings.service.js";
import { UpdateSettingsDto } from "./update-settings.dto.js";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get("public")
  getPublic() {
    return this.settings.publicSettings();
  }

  @Get("admin")
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  getAdmin() {
    return this.settings.getAdminSettings();
  }

  @Patch("admin")
  @UseGuards(SessionAuthGuard, RolesGuard, AdminOriginGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  update(
    @Body() dto: UpdateSettingsDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.settings.update(dto, admin.id, request.ip);
  }
}
