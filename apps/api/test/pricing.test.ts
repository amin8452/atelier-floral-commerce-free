import { describe, expect, it } from "vitest";
import { DiscountType } from "../src/generated/prisma/enums.js";
import { calculatePricing, effectivePrice, serializePricing } from "../src/pricing/pricing.js";

describe("pricing", () => {
  it("prioritises the variant sale price", () => {
    expect(effectivePrice({ basePrice: "100", salePrice: "90" }, { price: "80", salePrice: "70" }).toFixed(3)).toBe("70.000");
  });

  it("calculates percentage promotion, delivery and tax on the server", () => {
    const result = calculatePricing(
      [{ unitPrice: "10.000", quantity: 2 }, { unitPrice: "5.500", quantity: 1 }],
      { discountType: DiscountType.PERCENTAGE, discountValue: "10" },
      "4",
      "0.19",
    );
    expect(serializePricing(result)).toEqual({
      subtotal: "25.500",
      discount: "2.550",
      shipping: "4.000",
      tax: "5.121",
      total: "32.071",
    });
  });

  it("never discounts below zero", () => {
    const result = calculatePricing([{ unitPrice: 10, quantity: 1 }], { discountType: DiscountType.FIXED, discountValue: 50 }, 0, 0);
    expect(result.total.toFixed(3)).toBe("0.000");
    expect(result.discount.toFixed(3)).toBe("10.000");
  });
});
