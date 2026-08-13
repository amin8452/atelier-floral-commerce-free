import type { Taxonomy } from "@/types/api";
import { serverApiGet } from "./server-api-client";

export const getCategories = () => serverApiGet<Taxonomy[]>("/categories", { tags: ["categories"] });
export const getCollections = () => serverApiGet<Taxonomy[]>("/collections", { tags: ["collections"] });
