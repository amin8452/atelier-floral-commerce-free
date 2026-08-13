import { CanActivate, ForbiddenException, Injectable, type ExecutionContext } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { getAppConfig } from "../config/app.config.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

@Injectable()
export class AdminOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;
    const appConfig = getAppConfig(this.config);
    const origin = request.header("origin");
    if (!origin && appConfig.nodeEnv !== "production") return true;
    if (!origin || !appConfig.corsOrigins.includes(origin)) {
      throw new ForbiddenException("Origine de requête non autorisée.");
    }
    return true;
  }
}
