import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AdminAuditAction, UserRole } from "../generated/prisma/enums.js";
import { AuditService } from "../common/audit/audit.service.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import { hashPassword, verifyPassword } from "../common/security/password.js";
import { createOpaqueToken, hashToken, safeEqualText } from "../common/security/tokens.js";
import { getAuthConfig } from "../config/auth.config.js";
import type { BootstrapAdminDto, ChangePasswordDto, CreateAdminDto, LoginDto, UpdateAdminDto, UpdateProfileDto } from "./auth.dto.js";
import type { AuthenticatedAdmin } from "./auth.types.js";

type RequestContext = { ipAddress?: string | undefined; userAgent?: string | undefined };

@Injectable()
export class AuthService {
  private readonly dummyPasswordHash = hashPassword("not-a-real-password-value");

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async bootstrap(dto: BootstrapAdminDto, providedToken: string | undefined, context: RequestContext) {
    const configuredToken = getAuthConfig(this.config).bootstrapToken;
    if (!configuredToken || !providedToken || !safeEqualText(providedToken, configuredToken)) {
      throw new UnauthorizedException("Initialisation non autorisée.");
    }
    if ((await this.prisma.adminUser.count()) > 0) throw new ConflictException("Un compte administrateur existe déjà.");
    const passwordHash = await hashPassword(dto.password);
    const admin = await this.prisma.$transaction(async (tx) => {
      if ((await tx.adminUser.count()) > 0) throw new ConflictException("Un compte administrateur existe déjà.");
      return tx.adminUser.create({
        data: {
          email: dto.email.trim().toLowerCase(),
          passwordHash,
          firstName: dto.firstName?.trim() || null,
          lastName: dto.lastName?.trim() || null,
          role: UserRole.SUPER_ADMIN,
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true },
      });
    }, { isolationLevel: "Serializable" });
    await this.audit.record({
      actorId: admin.id,
      action: AdminAuditAction.ADMIN_BOOTSTRAPPED,
      resourceType: "AdminUser",
      resourceId: admin.id,
      ipAddress: context.ipAddress,
    });
    return admin;
  }

  async login(dto: LoginDto, context: RequestContext) {
    const email = dto.email.trim().toLowerCase();
    const admin = await this.prisma.adminUser.findUnique({ where: { email } });
    const validPassword = await verifyPassword(dto.password, admin?.passwordHash ?? (await this.dummyPasswordHash));
    if (!admin || !admin.isActive || !validPassword) {
      await this.audit.record({
        action: AdminAuditAction.LOGIN_FAILED,
        resourceType: "AdminSession",
        metadata: { reason: "invalid_credentials" },
        ipAddress: context.ipAddress,
      });
      throw new UnauthorizedException("Identifiants invalides.");
    }

    const token = createOpaqueToken();
    const authConfig = getAuthConfig(this.config);
    const expiresAt = new Date(Date.now() + authConfig.sessionTtlMs);
    await this.prisma.$transaction([
      this.prisma.adminSession.deleteMany({ where: { expiresAt: { lte: new Date() } } }),
      this.prisma.adminSession.create({
        data: {
          adminUserId: admin.id,
          tokenHash: hashToken(token, authConfig.sessionPepper),
          expiresAt,
          ipAddress: context.ipAddress ?? null,
          userAgent: context.userAgent?.slice(0, 500) ?? null,
        },
      }),
    ]);
    await this.audit.record({
      actorId: admin.id,
      action: AdminAuditAction.LOGIN_SUCCEEDED,
      resourceType: "AdminSession",
      ipAddress: context.ipAddress,
    });
    return {
      token,
      expiresAt,
      admin: this.toAuthenticatedAdmin(admin),
    };
  }

  async resolveSession(token: string): Promise<AuthenticatedAdmin | null> {
    const authConfig = getAuthConfig(this.config);
    const session = await this.prisma.adminSession.findUnique({
      where: { tokenHash: hashToken(token, authConfig.sessionPepper) },
      include: { adminUser: true },
    });
    if (!session || session.expiresAt <= new Date() || !session.adminUser.isActive) return null;
    if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
      await this.prisma.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    }
    return this.toAuthenticatedAdmin(session.adminUser);
  }

  async logout(token: string | undefined, actorId: string, ipAddress?: string): Promise<void> {
    if (token) await this.prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token, getAuthConfig(this.config).sessionPepper) } });
    await this.audit.record({
      actorId,
      action: AdminAuditAction.LOGOUT,
      resourceType: "AdminSession",
      ipAddress,
    });
  }

  listAssignableAdmins() {
    return this.prisma.adminUser.findMany({
      where: { isActive: true },
      orderBy: [{ firstName: "asc" }, { email: "asc" }],
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
  }

  listAdminUsers() {
    return this.prisma.adminUser.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
    });
  }

  async createAdmin(dto: CreateAdminDto, actorId: string, ipAddress?: string) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.adminUser.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException("Un administrateur utilise déjà cet email.");
    }
    const admin = await this.prisma.adminUser.create({
      data: { email, passwordHash: await hashPassword(dto.password), firstName: dto.firstName?.trim() || null, lastName: dto.lastName?.trim() || null, role: dto.role },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
    });
    await this.audit.record({ actorId, action: AdminAuditAction.ADMIN_CREATED, resourceType: "AdminUser", resourceId: admin.id, metadata: { role: admin.role }, ipAddress });
    return admin;
  }

  async updateAdmin(id: string, dto: UpdateAdminDto, actorId: string, ipAddress?: string) {
    if (dto.email === undefined && dto.firstName === undefined && dto.lastName === undefined && dto.role === undefined && dto.isActive === undefined) {
      throw new BadRequestException("Aucune modification fournie.");
    }
    if (id === actorId && (dto.isActive === false || (dto.role !== undefined && dto.role !== UserRole.SUPER_ADMIN))) {
      throw new BadRequestException("Vous ne pouvez pas retirer vos propres droits de super-administration.");
    }
    const current = await this.prisma.adminUser.findUnique({ where: { id }, select: { id: true, email: true, role: true, isActive: true } });
    if (!current) throw new NotFoundException("Administrateur introuvable.");
    const email = dto.email?.trim().toLowerCase();
    if (email && email !== current.email && await this.prisma.adminUser.findUnique({ where: { email }, select: { id: true } })) {
      throw new ConflictException("Un administrateur utilise déjà cet email.");
    }
    const removesActiveSuperAdmin = current.isActive && current.role === UserRole.SUPER_ADMIN && (dto.isActive === false || (dto.role !== undefined && dto.role !== UserRole.SUPER_ADMIN));
    if (removesActiveSuperAdmin && (await this.prisma.adminUser.count({ where: { role: UserRole.SUPER_ADMIN, isActive: true } })) <= 1) {
      throw new BadRequestException("Le dernier super-administrateur actif doit être conservé.");
    }
    const admin = await this.prisma.adminUser.update({
      where: { id },
      data: {
        ...(email !== undefined ? { email } : {}),
        ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() || null } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() || null } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive, ...(!dto.isActive ? { sessions: { deleteMany: {} } } : {}) } : {}),
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
    });
    await this.audit.record({ actorId, action: AdminAuditAction.ADMIN_UPDATED, resourceType: "AdminUser", resourceId: id, metadata: { role: admin.role, isActive: admin.isActive }, ipAddress });
    return admin;
  }

  updateProfile(id: string, dto: UpdateProfileDto, ipAddress?: string) {
    return this.updateAdmin(id, dto, id, ipAddress);
  }

  async changePassword(id: string, dto: ChangePasswordDto, currentToken: string | undefined, ipAddress?: string) {
    const admin = await this.prisma.adminUser.findUnique({ where: { id }, select: { passwordHash: true } });
    if (!admin || !(await verifyPassword(dto.currentPassword, admin.passwordHash))) {
      throw new BadRequestException("Le mot de passe actuel est incorrect.");
    }
    if (await verifyPassword(dto.newPassword, admin.passwordHash)) {
      throw new BadRequestException("Le nouveau mot de passe doit être différent du mot de passe actuel.");
    }

    const tokenHash = currentToken ? hashToken(currentToken, getAuthConfig(this.config).sessionPepper) : null;
    await this.prisma.$transaction([
      this.prisma.adminUser.update({ where: { id }, data: { passwordHash: await hashPassword(dto.newPassword) } }),
      this.prisma.adminSession.deleteMany({
        where: { adminUserId: id, ...(tokenHash ? { tokenHash: { not: tokenHash } } : {}) },
      }),
    ]);
    await this.audit.record({
      actorId: id,
      action: AdminAuditAction.ADMIN_UPDATED,
      resourceType: "AdminUser",
      resourceId: id,
      metadata: { field: "password" },
      ipAddress,
    });
    return { success: true };
  }

  private toAuthenticatedAdmin(admin: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: UserRole;
  }): AuthenticatedAdmin {
    return { id: admin.id, email: admin.email, firstName: admin.firstName, lastName: admin.lastName, role: admin.role };
  }
}
