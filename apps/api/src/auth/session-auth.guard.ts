import { CanActivate, Injectable, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { parseCookies } from "../common/http/cookies.js";
import { getAuthConfig } from "../config/auth.config.js";
import { AuthService } from "./auth.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = parseCookies(request.headers.cookie)[getAuthConfig(this.config).cookieName];
    if (!token) throw new UnauthorizedException("Authentification requise.");
    const admin = await this.auth.resolveSession(token);
    if (!admin) throw new UnauthorizedException("Session invalide ou expirée.");
    request.admin = admin;
    return true;
  }
}
