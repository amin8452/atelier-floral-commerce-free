import { describe, expect, it } from "vitest";
import type { ProductListItem, Taxonomy } from "@/types/api";
import { selectFeaturedProducts, selectPublicCollections } from "./home-content";

const readyProduct: ProductListItem = {
  id: "ready",
  slug: "collier-floral",
  name: "Collier floral",
  shortDescription: "Une création florale.",
  basePrice: "79",
  salePrice: null,
  stock: 2,
  canQuickOrder: true,
  images: [{ url: "/collier.jpg", altText: "Collier floral" }],
};

describe("sélection du contenu de l’accueil", () => {
  it("met en avant les produits vendables même lorsque leur photo reste à ajouter", () => {
    const withoutImage = { ...readyProduct, id: "without-image", images: [] };
    const outOfStock = { ...readyProduct, id: "out-of-stock", stock: 0 };
    const freeProduct = { ...readyProduct, id: "free", basePrice: "0" };

    expect(selectFeaturedProducts([withoutImage, outOfStock, freeProduct, readyProduct])).toEqual([withoutImage, readyProduct]);
  });

  it("écarte les collections vides ou dont le texte public est corrompu", () => {
    const validCollection: Taxonomy = { id: "valid", name: "Éclats naturels", slug: "eclats-naturels", description: null, _count: { products: 1 } };
    const invalidCollection: Taxonomy = { ...validCollection, id: "invalid", name: `S${String.fromCodePoint(0xfffd)}lection` };
    const emptyCollection: Taxonomy = { ...validCollection, id: "empty", _count: { products: 0 } };

    expect(selectPublicCollections([invalidCollection, emptyCollection, validCollection])).toEqual([validCollection]);
  });
});
