import type { UserRole } from "../generated/prisma/enums.js";
import type { Request } from "express";

export type AuthenticatedAdmin = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
};

export type AuthenticatedRequest = Request & { admin?: AuthenticatedAdmin };
