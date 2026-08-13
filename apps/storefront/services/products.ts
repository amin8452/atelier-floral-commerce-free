import { serverApiGet } from "./server-api-client";
import type { ProductDetail, ProductListResponse } from "@/types/api";

export type ProductFilters = {
  page?: string;
  search?: string;
  category?: string;
  collection?: string;
  minPrice?: string;
  maxPrice?: string;
  available?: string;
  sort?: string;
  pageSize?: string;
};

export async function getProducts(filters: ProductFilters = {}): Promise<ProductListResponse> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
  return serverApiGet<ProductListResponse>(`/products${query.size ? `?${query}` : ""}`, { tags: ["products"] });
}

export function getProduct(slug: string): Promise<ProductDetail> {
  return serverApiGet<ProductDetail>(`/products/${encodeURIComponent(slug)}`, { tags: [`product:${slug}`] });
}
