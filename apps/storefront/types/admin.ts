import type { PaginationMeta, ProductListItem } from "./api";

export type AdminUser = { id: string; email: string; firstName: string | null; lastName: string | null; role: string };
export type DashboardMetrics = {
  revenueToday: string; revenueMonth: string; orderValueToday: string; orderValueMonth: string; orderCountMonth: number; pendingOrders: number; newLeads: number; averageBasket: string;
  period: { days: number; from: string; to: string };
  periodRevenue: string;
  periodOrderValue: string;
  cashOnDeliveryPending: string;
  periodLeadCount: number;
  comparisons: { revenue: number | null; orderValue: number | null; orders: number | null; averageBasket: number | null; leads: number | null };
  salesSeries: Array<{ date: string; orderValue: string; revenue: string; orders: number }>;
  fulfillmentDistribution: Array<{ key: string; count: number }>;
  leadDistribution: Array<{ key: string; count: number }>;
  lowStockProducts: Array<{ id: string; productId: string; name: string; slug: string; sku: string | null; stock: number }>;
  recentOrders: Array<{ id: string; orderNumber: string; total: string; paymentStatus: string; fulfillmentStatus: string; createdAt: string }>;
};
export type AdminProduct = Omit<ProductListItem, "canQuickOrder"> & {
  status: string; sku: string | null; updatedAt: string; category: { id: string; name: string } | null;
  deletionRequestedAt: string | null; deletionScheduledFor: string | null; deletionRequestedById: string | null;
  _count: { variants: number; leads: number; orderItems: number };
};
export type AdminProductResponse = {
  items: AdminProduct[];
  meta: PaginationMeta;
  scheduledDeletions: Array<{ id: string; name: string; deletionScheduledFor: string }>;
};
export type AdminLead = {
  id: string; firstName: string; lastName: string; phone: string; email: string | null; source: string; status: string;
  preferredContactMethod: string; createdAt: string; product: { id: string; name: string; slug: string; sku: string | null } | null;
  productVariant: { id: string; name: string; sku: string } | null; assignedTo: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
};
export type AdminOrder = {
  id: string; orderNumber: string; customerSnapshot: { firstName?: string; lastName?: string; phone?: string }; currency: string; total: string;
  paymentStatus: string; fulfillmentStatus: string; createdAt: string; payments: Array<{ method: string }>; _count: { items: number };
};
export type AdminOrderDetail = {
  id: string;
  orderNumber: string;
  customerSnapshot: { firstName?: string; lastName?: string; phone?: string; email?: string };
  shippingAddress: { line1?: string; line2?: string; city?: string; postalCode?: string; country?: string };
  currency: string;
  subtotal: string;
  discount: string;
  shipping: string;
  tax: string;
  total: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  notes: string | null;
  createdAt: string;
  payments: Array<{ id: string; method: string; status: string }>;
  items: Array<{ id: string; productNameSnapshot: string; skuSnapshot: string | null; variantSnapshot: { name?: string } | null; unitPrice: string; quantity: number; total: string; personalization: Record<string, string> | null }>;
  activities: Array<{ id: string; paymentStatus: string | null; fulfillmentStatus: string | null; note: string | null; createdAt: string; createdBy: { firstName: string | null; lastName: string | null } | null }>;
};
export type TaxonomyAdmin = { id: string; name: string; slug: string; description: string | null; isActive: boolean; _count: { products: number } };
export type AdminProductDetail = {
  id: string; name: string; slug: string; shortDescription: string | null; description: string | null; sku: string | null;
  basePrice: string; salePrice: string | null; stock: number; status: string; categoryId: string | null; tags: string[];
  deletionRequestedAt: string | null; deletionScheduledFor: string | null; deletionRequestedById: string | null;
  metaTitle: string | null; metaDescription: string | null; personalizationSchema: Record<string, unknown> | null;
  variants: Array<{ id: string; name: string; sku: string; options: Record<string, string>; price: string | null; salePrice: string | null; stock: number; isActive: boolean }>;
  images: Array<{ id: string; assetId: string; variantId: string | null; altText: string; sortOrder: number; isPrimary: boolean; asset: { id: string; url: string } }>;
  collections: Array<{ collectionId: string }>;
};
export type AdminMedia = { id: string; url: string; altText: string; mimeType: string; size: number; createdAt: string; usedByStore?: boolean; _count?: { productImages: number } };
export type AdminPromotion = { id: string; name: string; code: string; discountType: string; discountValue: string; minimumAmount: string | null; usageLimit: number | null; usageCount: number; isActive: boolean; startsAt: string | null; endsAt: string | null };
export type AdminCustomer = { id: string; firstName: string; lastName: string; phone: string; email: string | null; createdAt: string; paidTotal: string; _count: { orders: number; addresses: number } };
export type InventoryProduct = { id: string; name: string; sku: string | null; stock: number; status: string; updatedAt: string; variants: Array<{ id: string; name: string; sku: string; stock: number; isActive: boolean }> };
