import "server-only";

import { selectFeaturedProducts, selectPublicCollections } from "@/lib/home-content";
import { getProducts } from "./products";
import { getPublicSettings } from "./settings";
import { getCollections } from "./taxonomies";
import type { ProductListItem, StoreSettings, Taxonomy } from "@/types/api";

export type HomePageData = {
  settings: StoreSettings;
  featuredProducts: ProductListItem[] | null;
  collections: Taxonomy[];
};

export async function getHomePageData(): Promise<HomePageData> {
  const [settings, catalogResults] = await Promise.all([
    getPublicSettings(),
    Promise.allSettled([
      getProducts({ pageSize: "12", sort: "newest" }),
      getCollections(),
    ]),
  ]);
  const [productsResult, collectionsResult] = catalogResults;

  return {
    settings,
    featuredProducts: productsResult.status === "fulfilled" ? selectFeaturedProducts(productsResult.value.items) : null,
    collections: collectionsResult.status === "fulfilled" ? selectPublicCollections(collectionsResult.value) : [],
  };
}
