import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AdminOriginGuard } from "./admin-origin.guard.js";
import { AuthService } from "./auth.service.js";
import { RolesGuard } from "./roles.guard.js";
import { SessionAuthGuard } from "./session-auth.guard.js";

@Module({
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard, RolesGuard, AdminOriginGuard],
  exports: [AuthService, SessionAuthGuard, RolesGuard, AdminOriginGuard],
})
export class AuthModule {}
