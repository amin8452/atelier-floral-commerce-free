import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { memoryStorage } from "multer";
import { UserRole } from "../generated/prisma/enums.js";
import { AdminOriginGuard } from "../auth/admin-origin.guard.js";
import { CurrentAdmin } from "../auth/current-admin.decorator.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import type { AuthenticatedAdmin } from "../auth/auth.types.js";
import { PaginationDto } from "../common/pagination/pagination.dto.js";
import { getStorageConfig } from "../config/storage.config.js";
import { UploadMediaDto } from "./media.dto.js";
import { MediaService } from "./media.service.js";

const ABSOLUTE_UPLOAD_LIMIT = 25 * 1024 * 1024;

@Controller("media/admin")
@UseGuards(SessionAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.PRODUCT_MANAGER)
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  list(@Query() query: PaginationDto) { return this.media.list(query); }

  @Post()
  @UseGuards(AdminOriginGuard)
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: ABSOLUTE_UPLOAD_LIMIT, files: 1 } }))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadMediaDto,
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Req() request: Request,
  ) {
    return this.media.upload(file, dto, admin.id, getStorageConfig(this.config).maxBytes, request.ip);
  }

  @Delete(":id")
  @UseGuards(AdminOriginGuard)
  delete(@Param("id", ParseUUIDPipe) id: string, @CurrentAdmin() admin: AuthenticatedAdmin, @Req() request: Request) {
    return this.media.delete(id, admin.id, request.ip);
  }
}
