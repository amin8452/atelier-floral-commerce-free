import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { parseCookies } from "../common/http/cookies.js";
import { getAuthConfig } from "../config/auth.config.js";
import { AdminOriginGuard } from "./admin-origin.guard.js";
import { AuthService } from "./auth.service.js";
import { BootstrapAdminDto, ChangePasswordDto, CreateAdminDto, LoginDto, UpdateAdminDto, UpdateProfileDto } from "./auth.dto.js";
import { CurrentAdmin } from "./current-admin.decorator.js";
import { SessionAuthGuard } from "./session-auth.guard.js";
import type { AuthenticatedAdmin } from "./auth.types.js";
import { Roles } from "./roles.decorator.js";
import { RolesGuard } from "./roles.guard.js";
import { UserRole } from "../generated/prisma/enums.js";

@Controller("auth")
@UseGuards(AdminOriginGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post("bootstrap")
  @Throttle({ default: { limit: 3, ttl: 60_000, blockDuration: 10 * 60_000 } })
  bootstrap(
    @Body() dto: BootstrapAdminDto,
    @Headers("x-bootstrap-token") bootstrapToken: string | undefined,
    @Req() request: Request,
  ) {
    return this.auth.bootstrap(dto, bootstrapToken, this.requestContext(request));
  }

  @Post("login")
  @Throttle({ default: { limit: 8, ttl: 60_000, blockDuration: 60_000 } })
  async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(dto, this.requestContext(request));
    const authConfig = getAuthConfig(this.config);
    response.cookie(authConfig.cookieName, result.token, {
      httpOnly: true,
      secure: authConfig.secureCookie,
      sameSite: "lax",
      path: "/",
      expires: result.expiresAt,
    });
    return { admin: result.admin, expiresAt: result.expiresAt };
  }

  @Get("session")
  @UseGuards(SessionAuthGuard)
  session(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return { admin };
  }

  @Patch("profile")
  @UseGuards(SessionAuthGuard)
  updateProfile(@Body() dto: UpdateProfileDto, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() request: Request) {
    return this.auth.updateProfile(admin.id, dto, request.ip);
  }

  @Patch("profile/password")
  @UseGuards(SessionAuthGuard)
  changePassword(@Body() dto: ChangePasswordDto, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() request: Request) {
    const authConfig = getAuthConfig(this.config);
    const token = parseCookies(request.headers.cookie)[authConfig.cookieName];
    return this.auth.changePassword(admin.id, dto, token, request.ip);
  }

  @Get("admins")
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SUPPORT)
  admins() {
    return this.auth.listAssignableAdmins();
  }

  @Get("admin-users")
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  adminUsers() { return this.auth.listAdminUsers(); }

  @Post("admin-users")
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  createAdmin(@Body() dto: CreateAdminDto, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() request: Request) {
    return this.auth.createAdmin(dto, admin.id, request.ip);
  }

  @Patch("admin-users/:id")
  @UseGuards(SessionAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  updateAdmin(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateAdminDto, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() request: Request) {
    return this.auth.updateAdmin(id, dto, admin.id, request.ip);
  }

  @Post("logout")
  @UseGuards(SessionAuthGuard)
  async logout(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const authConfig = getAuthConfig(this.config);
    const token = parseCookies(request.headers.cookie)[authConfig.cookieName];
    await this.auth.logout(token, admin.id, request.ip);
    response.clearCookie(authConfig.cookieName, {
      httpOnly: true,
      secure: authConfig.secureCookie,
      sameSite: "lax",
      path: "/",
    });
    return { success: true };
  }

  private requestContext(request: Request) {
    return { ipAddress: request.ip, userAgent: request.header("user-agent") };
  }
}
