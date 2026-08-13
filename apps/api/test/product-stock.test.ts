import { describe, expect, it } from "vitest";
import { activeVariantStock, productStock } from "../src/products/product-stock.js";

describe("product stock", () => {
  it("uses the global quantity for a product without variants", () => {
    expect(productStock(12, [])).toBe(12);
  });

  it("sums only active variants", () => {
    const variants = [
      { stock: 4, isActive: true },
      { stock: 7, isActive: false },
      { stock: 3 },
    ];

    expect(activeVariantStock(variants)).toBe(7);
    expect(productStock(99, variants)).toBe(7);
  });
});
