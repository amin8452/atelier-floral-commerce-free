export const PRODUCT_STATUS = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
} as const;

export type ProductStatus = (typeof PRODUCT_STATUS)[keyof typeof PRODUCT_STATUS];

export const LEAD_STATUS = {
  NEW: "NEW",
  CONTACTED: "CONTACTED",
  INTERESTED: "INTERESTED",
  CONVERTED: "CONVERTED",
  LOST: "LOST",
} as const;

export type LeadStatus = (typeof LEAD_STATUS)[keyof typeof LEAD_STATUS];

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  PAID: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
  CANCELLED: "CANCELLED",
} as const;

export const FULFILLMENT_STATUS = {
  NEW: "NEW",
  PROCESSING: "PROCESSING",
  READY: "READY",
  SHIPPED: "SHIPPED",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
} as const;

export function formatMoney(value: string | number, currency: string, locale: string): string {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) throw new Error("Invalid monetary value");
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(numericValue);
}

type ProductWhatsAppMessage = {
  number: string;
  productName: string;
  sku?: string | null;
  variant?: string | null;
  price: string;
  productUrl: string;
};

export function buildProductWhatsAppUrl(input: ProductWhatsAppMessage): string {
  const number = normalizeWhatsAppNumber(input.number);
  const message = [
    "Bonjour,",
    "",
    "Je suis intéressé(e) par :",
    input.productName,
    "",
    "Référence : " + (input.sku ?? "—"),
    "Variante : " + (input.variant ?? "—"),
    "Prix : " + input.price,
    "Lien : " + input.productUrl,
    "",
    "Pouvez-vous me donner plus d'informations ?",
  ].join("\n");
  return "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
}

export function buildAdminWhatsAppUrl(number: string, firstName: string, productName: string | null): string {
  const message = [
    "Bonjour " + firstName + ",",
    "",
    "Nous vous contactons concernant votre demande pour :",
    productName ?? "votre demande",
    "",
    "Comment pouvons-nous vous aider ?",
  ].join("\n");
  return "https://wa.me/" + normalizeWhatsAppNumber(number) + "?text=" + encodeURIComponent(message);
}

function normalizeWhatsAppNumber(value: string): string {
  const normalized = value.replace(/[^0-9]/g, "");
  if (normalized.length < 6 || normalized.length > 15) throw new Error("Invalid WhatsApp number");
  return normalized;
}
