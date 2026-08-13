import { describe, expect, it } from "vitest";
import { buildStoreWhatsAppUrl } from "./whatsapp";

describe("buildStoreWhatsAppUrl", () => {
  it("normalise le numéro et encode le message", () => {
    const url = buildStoreWhatsAppUrl("+216 20 000 000", "Bonjour, je souhaite personnaliser un bijou.");

    expect(url).toBe("https://wa.me/21620000000?text=Bonjour%2C%20je%20souhaite%20personnaliser%20un%20bijou.");
  });

  it("ignore une configuration absente ou invalide", () => {
    expect(buildStoreWhatsAppUrl(null)).toBeNull();
    expect(buildStoreWhatsAppUrl("123")).toBeNull();
  });
});
