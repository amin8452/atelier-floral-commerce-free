export type StockVariant = { stock: number; isActive?: boolean };

export function activeVariantStock(variants: readonly StockVariant[]): number {
  return variants.reduce(
    (total, variant) => total + (variant.isActive === false ? 0 : Math.max(0, variant.stock)),
    0,
  );
}

export function productStock(simpleStock: number, variants: readonly StockVariant[] | undefined): number {
  return variants?.length ? activeVariantStock(variants) : Math.max(0, simpleStock);
}
