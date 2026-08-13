export type PaginationMeta = { page: number; pageSize: number; total: number; pageCount: number };

export type StoreSettings = {
  storeName: string;
  storeEmail: string | null;
  supportEmail: string | null;
  defaultCurrency: string;
  defaultLocale: string;
  whatsappNumber: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  shippingEnabled: boolean;
  shippingFlatRate: string;
  codEnabled: boolean;
  onlinePaymentEnabled: boolean;
  instagramUrl: string | null;
  facebookUrl: string | null;
  heroImageUrl: string | null;
  storyImageUrl: string | null;
};

export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  basePrice: string;
  salePrice: string | null;
  stock: number;
  canQuickOrder: boolean;
  images: Array<{ url: string; altText: string }>;
};

export type ProductListResponse = { items: ProductListItem[]; meta: PaginationMeta };

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  sku: string | null;
  shortDescription: string | null;
  description: string | null;
  basePrice: string;
  salePrice: string | null;
  stock: number;
  tags: string[];
  personalizationSchema: Record<string, unknown> | null;
  metaTitle: string | null;
  metaDescription: string | null;
  images: Array<{ id: string; url: string; altText: string; sortOrder: number; isPrimary: boolean; variantId: string | null }>;
  variants: Array<{
    id: string;
    name: string;
    sku: string;
    options: Record<string, string>;
    price: string | null;
    salePrice: string | null;
    stock: number;
  }>;
  category: { name: string; slug: string } | null;
  collections: Array<{ name: string; slug: string }>;
};

export type Taxonomy = { id: string; name: string; slug: string; description: string | null; _count: { products: number } };

export type Cart = {
  items: Array<{
    id: string;
    productId: string;
    variantId: string | null;
    name: string;
    slug: string;
    sku: string | null;
    variantName: string | null;
    quantity: number;
    personalization: Record<string, string> | null;
    unitPrice: string;
    lineTotal: string;
    availableStock: number;
    image: { url: string; altText: string } | null;
  }>;
  subtotal: string;
  currency: string;
  locale: string;
  expiresAt: string;
};
