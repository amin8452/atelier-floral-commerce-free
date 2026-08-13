import type { MetadataRoute } from "next";
import { appConfig } from "@/lib/config";
import { getProducts } from "@/services/products";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const paths = ["", "/boutique", "/collections", "/a-propos", "/contact"];
  const entries: MetadataRoute.Sitemap = paths.map((path) => ({
    url: appConfig.appUrl + path,
    lastModified: new Date(),
    changeFrequency: path === "" || path === "/boutique" ? "daily" : "monthly",
    priority: path === "" ? 1 : path === "/boutique" ? .9 : .6,
  }));
  try {
    let page = 1;
    let pageCount = 1;
    do {
      const result = await getProducts({ page: String(page), pageSize: "100" });
      entries.push(...result.items.map((product) => ({
        url: appConfig.appUrl + "/produit/" + encodeURIComponent(product.slug),
        changeFrequency: "weekly" as const,
        priority: .8,
      })));
      pageCount = result.meta.pageCount;
      page += 1;
    } while (page <= pageCount);
  } catch {
    // Static routes remain discoverable while the catalogue API is unavailable.
  }
  return entries;
}
