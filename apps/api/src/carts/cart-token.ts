import { BadRequestException } from "@nestjs/common";

export function requireCartToken(token: string | undefined): string {
  if (!token || token.length < 32 || token.length > 200) throw new BadRequestException("Jeton de panier invalide.");
  return token;
}
