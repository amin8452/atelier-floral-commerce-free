import type { ProductListItem, Taxonomy } from "@/types/api";

const INVALID_PUBLIC_CHARACTER = /[\uFFFD]/;

export function selectFeaturedProducts(products: ProductListItem[], limit = 4): ProductListItem[] {
  return products
    .filter((product) => product.stock > 0 && hasPositivePrice(product))
    .slice(0, limit);
}

export function selectPublicCollections(collections: Taxonomy[], limit = 3): Taxonomy[] {
  return collections
    .filter((collection) => collection._count.products > 0 && isValidPublicText(collection.name) && isValidPublicText(collection.description))
    .slice(0, limit);
}

function hasPositivePrice(product: ProductListItem): boolean {
  const price = Number(product.salePrice ?? product.basePrice);
  return Number.isFinite(price) && price > 0;
}

function isValidPublicText(value: string | null): boolean {
  return value === null || !INVALID_PUBLIC_CHARACTER.test(value);
}
