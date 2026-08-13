import { CanActivate, ForbiddenException, Injectable, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole } from "../generated/prisma/enums.js";
import type { AuthenticatedRequest } from "./auth.types.js";
import { ROLES_KEY } from "./roles.decorator.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles || roles.length === 0) return true;
    const admin = context.switchToHttp().getRequest<AuthenticatedRequest>().admin;
    if (!admin || !roles.includes(admin.role)) throw new ForbiddenException("Permission insuffisante.");
    return true;
  }
}
