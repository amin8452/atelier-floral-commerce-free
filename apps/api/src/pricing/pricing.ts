import { Decimal } from "decimal.js";
import type { DiscountType } from "../generated/prisma/enums.js";

const MONEY_SCALE = 3;

export type PricingLine = { unitPrice: Decimal.Value; quantity: number };
export type PromotionInput = { discountType: DiscountType; discountValue: Decimal.Value } | null;

export type PricingResult = {
  subtotal: Decimal;
  discount: Decimal;
  shipping: Decimal;
  tax: Decimal;
  total: Decimal;
};

function money(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP);
}

export function effectivePrice(product: { basePrice: Decimal.Value; salePrice: Decimal.Value | null }, variant?: { price: Decimal.Value | null; salePrice: Decimal.Value | null } | null): Decimal {
  return money(variant?.salePrice ?? variant?.price ?? product.salePrice ?? product.basePrice);
}

export function calculatePricing(
  lines: PricingLine[],
  promotion: PromotionInput,
  shippingFlatRate: Decimal.Value,
  taxRate: Decimal.Value,
): PricingResult {
  const subtotal = money(lines.reduce((sum, line) => sum.plus(new Decimal(line.unitPrice).times(line.quantity)), new Decimal(0)));
  let discount = new Decimal(0);
  if (promotion) {
    discount = promotion.discountType === "PERCENTAGE"
      ? subtotal.times(promotion.discountValue).dividedBy(100)
      : new Decimal(promotion.discountValue);
  }
  discount = money(Decimal.min(Decimal.max(discount, 0), subtotal));
  const shipping = money(shippingFlatRate);
  const taxableAmount = subtotal.minus(discount).plus(shipping);
  const tax = money(taxableAmount.times(taxRate));
  return { subtotal, discount, shipping, tax, total: money(taxableAmount.plus(tax)) };
}

export function serializePricing(pricing: PricingResult) {
  return {
    subtotal: pricing.subtotal.toFixed(MONEY_SCALE),
    discount: pricing.discount.toFixed(MONEY_SCALE),
    shipping: pricing.shipping.toFixed(MONEY_SCALE),
    tax: pricing.tax.toFixed(MONEY_SCALE),
    total: pricing.total.toFixed(MONEY_SCALE),
  };
}
