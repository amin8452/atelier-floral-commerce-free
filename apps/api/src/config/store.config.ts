import { ConfigService } from "@nestjs/config";

export function getStoreDefaults(config: ConfigService) {
  return {
    storeName: config.getOrThrow<string>("STORE_NAME"),
    defaultCurrency: config.getOrThrow<string>("STORE_DEFAULT_CURRENCY"),
    defaultLocale: config.getOrThrow<string>("STORE_DEFAULT_LOCALE"),
    shippingFlatRate: config.getOrThrow<number>("STORE_SHIPPING_FLAT_RATE"),
    taxRate: config.getOrThrow<number>("STORE_TAX_RATE"),
    whatsappNumber: config.get<string>("WHATSAPP_NUMBER") || null,
  };
}
