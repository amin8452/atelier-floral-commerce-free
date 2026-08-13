import { ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { UserRole } from "../src/generated/prisma/enums.js";
import { AuthService } from "../src/auth/auth.service.js";
import { RolesGuard } from "../src/auth/roles.guard.js";
import type { AuditService } from "../src/common/audit/audit.service.js";
import type { PrismaService } from "../src/common/prisma/prisma.service.js";
import { hashPassword, verifyPassword } from "../src/common/security/password.js";

describe("admin authentication", () => {
  it("hashes passwords with a salted non-reversible scrypt representation", async () => {
    const first = await hashPassword("long-secure-password");
    const second = await hashPassword("long-secure-password");
    expect(first).not.toBe(second);
    expect(first).not.toContain("long-secure-password");
    await expect(verifyPassword("long-secure-password", first)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", first)).resolves.toBe(false);
  });

  it("stores only a hash of the opaque session token", async () => {
    const passwordHash = await hashPassword("long-secure-password");
    const createSession = vi.fn();
    const prisma = {
      adminUser: { findUnique: vi.fn().mockResolvedValue({ id: "admin-id", email: "admin@example.test", firstName: null, lastName: null, role: UserRole.ADMIN, isActive: true, passwordHash }) },
      adminSession: { deleteMany: vi.fn(), create: createSession },
      $transaction: vi.fn().mockResolvedValue([]),
    } as unknown as PrismaService;
    const config = {
      get: vi.fn().mockReturnValue(undefined),
      getOrThrow: vi.fn((key: string) => key === "SESSION_COOKIE_NAME" ? "session" : key === "NODE_ENV" ? "test" : key === "SESSION_SECRET" ? "test-session-secret-with-32-characters" : 12),
    } as unknown as ConfigService;
    const audit = { record: vi.fn() } as unknown as AuditService;
    const result = await new AuthService(prisma, config, audit).login({ email: "ADMIN@example.test", password: "long-secure-password" }, {});
    const data = createSession.mock.calls[0]?.[0]?.data as { tokenHash: string };
    expect(data.tokenHash).toHaveLength(64);
    expect(data.tokenHash).not.toBe(result.token);
  });

  it("changes the password and revokes every other session", async () => {
    const passwordHash = await hashPassword("current-secure-password");
    const updateAdmin = vi.fn();
    const deleteSessions = vi.fn();
    const prisma = {
      adminUser: {
        findUnique: vi.fn().mockResolvedValue({ passwordHash }),
        update: updateAdmin,
      },
      adminSession: { deleteMany: deleteSessions },
      $transaction: vi.fn().mockResolvedValue([]),
    } as unknown as PrismaService;
    const config = {
      get: vi.fn().mockReturnValue(undefined),
      getOrThrow: vi.fn((key: string) => key === "SESSION_COOKIE_NAME" ? "session" : key === "NODE_ENV" ? "test" : key === "SESSION_SECRET" ? "test-session-secret-with-32-characters" : 12),
    } as unknown as ConfigService;
    const audit = { record: vi.fn() } as unknown as AuditService;

    await new AuthService(prisma, config, audit).changePassword(
      "admin-id",
      { currentPassword: "current-secure-password", newPassword: "different-secure-password" },
      "current-session-token",
      "127.0.0.1",
    );

    const updatedHash = updateAdmin.mock.calls[0]?.[0]?.data?.passwordHash as string;
    await expect(verifyPassword("different-secure-password", updatedHash)).resolves.toBe(true);
    expect(deleteSessions.mock.calls[0]?.[0]?.where.tokenHash.not).toHaveLength(64);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ metadata: { field: "password" } }));
  });
});

describe("RBAC", () => {
  it("rejects a role not listed on the endpoint", () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue([UserRole.ADMIN]) } as unknown as Reflector;
    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({ getRequest: () => ({ admin: { role: UserRole.SUPPORT } }) }),
    } as unknown as ExecutionContext;
    expect(() => new RolesGuard(reflector).canActivate(context)).toThrow(ForbiddenException);
  });
});
