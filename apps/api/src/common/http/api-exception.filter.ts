import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";

type ErrorBody = {
  statusCode: number;
  message: string | string[];
  error?: string;
  requestId: string;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const requestId = request.header("x-request-id")?.slice(0, 100) || randomUUID();
    const databaseError = this.databaseError(exception);
    const status = exception instanceof HttpException ? exception.getStatus() : databaseError?.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    if (databaseError) {
      response.setHeader("x-request-id", requestId);
      response.status(status).json({ statusCode: status, message: databaseError.message, requestId });
      return;
    }
    const body = this.toSafeBody(exception, status, requestId);

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      response.setHeader("retry-after", "60");
    }

    if (status >= 500) {
      const detail = exception instanceof Error ? exception.stack ?? exception.message : String(exception);
      this.logger.error(`${request.method} ${request.originalUrl} [${requestId}]`, detail);
    }

    response.setHeader("x-request-id", requestId);
    response.status(status).json(body);
  }

  private databaseError(exception: unknown): { status: number; message: string } | null {
    if (typeof exception !== "object" || exception === null || !("code" in exception)) return null;
    const code = String(exception.code);
    if (code === "P2002") return { status: HttpStatus.CONFLICT, message: "Une valeur unique est déjà utilisée." };
    if (code === "P2003") return { status: HttpStatus.CONFLICT, message: "Cette ressource est encore utilisée." };
    if (code === "P2025") return { status: HttpStatus.NOT_FOUND, message: "Ressource introuvable." };
    return null;
  }

  private toSafeBody(exception: unknown, status: number, requestId: string): ErrorBody {
    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      return {
        statusCode: status,
        message: "Trop de tentatives de connexion. Patientez une minute avant de réessayer.",
        error: "Trop de requêtes",
        requestId,
      };
    }

    if (!(exception instanceof HttpException)) {
      return { statusCode: status, message: "Une erreur interne est survenue.", requestId };
    }

    const value = exception.getResponse();
    if (typeof value === "string") return { statusCode: status, message: value, requestId };
    if (typeof value === "object" && value !== null) {
      const record = value as Record<string, unknown>;
      const message = record.message;
      return {
        statusCode: status,
        message: typeof message === "string" || Array.isArray(message) ? (message as string | string[]) : exception.message,
        ...(typeof record.error === "string" ? { error: record.error } : {}),
        requestId,
      };
    }
    return { statusCode: status, message: exception.message, requestId };
  }
}
