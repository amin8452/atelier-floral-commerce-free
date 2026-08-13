import { Injectable } from "@nestjs/common";
import type { AdminAuditAction, Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

export type AuditEntry = {
  actorId?: string | undefined;
  action: AdminAuditAction;
  resourceType: string;
  resourceId?: string | undefined;
  metadata?: Prisma.InputJsonValue | undefined;
  ipAddress?: string | undefined;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.adminAudit.create({
      data: {
        action: entry.action,
        resourceType: entry.resourceType,
        actorId: entry.actorId ?? null,
        resourceId: entry.resourceId ?? null,
        ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
        ipAddress: entry.ipAddress ?? null,
      },
    });
  }
}
