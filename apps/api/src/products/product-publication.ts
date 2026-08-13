import { Decimal } from "decimal.js";
import { activeVariantStock, type StockVariant } from "./product-stock.js";

export type ProductPublicationCandidate = {
  name: string;
  basePrice: string;
  shortDescription?: string | null;
  description?: string | null;
  stock: number;
  variants?: readonly StockVariant[];
};

export function productPublicationIssues(candidate: ProductPublicationCandidate): string[] {
  const issues: string[] = [];
  const availableStock = candidate.variants?.length
    ? activeVariantStock(candidate.variants)
    : candidate.stock;

  if (candidate.name.trim().length < 3) issues.push("un nom commercial d’au moins 3 caractères");
  if (!new Decimal(candidate.basePrice).greaterThan(0)) issues.push("un prix strictement supérieur à 0");
  if (!candidate.shortDescription?.trim() && !candidate.description?.trim()) issues.push("une description du produit");
  if (availableStock < 1) issues.push("un stock disponible");

  return issues;
}

export function productPublicationError(candidate: ProductPublicationCandidate): string | null {
  const issues = productPublicationIssues(candidate);
  return issues.length
    ? `Impossible de publier ce produit. Complétez : ${issues.join(", ")}.`
    : null;
}
