import { appConfig } from "@/lib/config";
import type { StoreSettings } from "@/types/api";
import { cache } from "react";
import { serverApiGet } from "./server-api-client";

export const getPublicSettings = cache(async (): Promise<StoreSettings> => {
  try {
    const settings = await serverApiGet<StoreSettings | null>("/settings/public", { tags: ["settings"] });
    if (settings) return settings;
  } catch {
    // Branding remains usable during an API outage; data pages expose their own error state.
  }
  return {
    storeName: appConfig.fallbackStoreName,
    storeEmail: null,
    supportEmail: null,
    defaultCurrency: appConfig.fallbackCurrency,
    defaultLocale: appConfig.fallbackLocale,
    whatsappNumber: null,
    address: null,
    city: null,
    country: null,
    shippingEnabled: false,
    shippingFlatRate: "0",
    codEnabled: false,
    onlinePaymentEnabled: false,
    instagramUrl: null,
    facebookUrl: null,
    heroImageUrl: null,
    storyImageUrl: null,
  };
});
