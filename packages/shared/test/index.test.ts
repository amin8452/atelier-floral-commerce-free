import { describe, expect, it } from "vitest";
import { buildAdminWhatsAppUrl, buildProductWhatsAppUrl, formatMoney } from "../src/index.js";

describe("shared commerce helpers", () => {
  it("formats TND with three decimals", () => {
    expect(formatMoney("59.5", "TND", "fr-TN")).toContain("59,500");
  });

  it("builds an encoded product WhatsApp URL", () => {
    const url = buildProductWhatsAppUrl({
      number: "+216 20 000 000",
      productName: "Collier floral",
      sku: "COL-1",
      price: "59,000 TND",
      productUrl: "https://shop.example/produit/collier",
    });
    expect(url.startsWith("https://wa.me/21620000000?text=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("Collier floral");
  });

  it("builds an admin follow-up message", () => {
    expect(decodeURIComponent(buildAdminWhatsAppUrl("+21620000000", "Inès", "Bracelet"))).toContain("Bonjour Inès");
  });
});
