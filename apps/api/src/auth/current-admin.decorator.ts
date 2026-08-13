import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedAdmin, AuthenticatedRequest } from "./auth.types.js";

export const CurrentAdmin = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedAdmin => {
  const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
  if (!request.admin) throw new Error("CurrentAdmin requires SessionAuthGuard");
  return request.admin;
});
