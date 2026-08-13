import { describe, expect, it } from "vitest";
import { productPublicationError, productPublicationIssues } from "../src/products/product-publication.js";

describe("product publication readiness", () => {
  it("refuses an incomplete product with an actionable message", () => {
    const error = productPublicationError({ name: "x", basePrice: "0", description: null, stock: 0 });

    expect(error).toContain("nom commercial");
    expect(error).toContain("prix strictement supérieur à 0");
    expect(error).toContain("description");
    expect(error).toContain("stock disponible");
  });

  it("accepts a sellable product and sums only active variants", () => {
    expect(productPublicationIssues({
      name: "Collier cœur fleuri",
      basePrice: "79.000",
      shortDescription: "Collier en résine avec fleurs séchées.",
      stock: 0,
      variants: [{ stock: 0, isActive: false }, { stock: 2, isActive: true }],
    })).toEqual([]);
  });
});
