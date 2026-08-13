import { FulfillmentStatus, PaymentMethod, PaymentStatus } from "../generated/prisma/enums.js";

type DashboardOrder = {
  createdAt: Date;
  total: { toString(): string };
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  payments?: Array<{ method: PaymentMethod }>;
};

const EXCLUDED_ORDER_VALUE_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.CANCELLED,
  PaymentStatus.FAILED,
  PaymentStatus.REFUNDED,
]);

export function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function dayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function sumTotals(orders: Array<{ total: { toString(): string } }>): number {
  return orders.reduce((sum, order) => sum + Number(order.total.toString()), 0);
}

export function changePercent(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export function countsTowardsOrderValue(order: Pick<DashboardOrder, "paymentStatus" | "fulfillmentStatus">): boolean {
  return order.fulfillmentStatus !== FulfillmentStatus.CANCELLED && !EXCLUDED_ORDER_VALUE_STATUSES.has(order.paymentStatus);
}

export function isCashOnDeliveryPending(order: Pick<DashboardOrder, "paymentStatus" | "fulfillmentStatus" | "payments">): boolean {
  return countsTowardsOrderValue(order)
    && order.paymentStatus === PaymentStatus.PENDING
    && Boolean(order.payments?.some((payment) => payment.method === PaymentMethod.CASH_ON_DELIVERY));
}

export function distribution(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].map(([key, count]) => ({ key, count })).sort((left, right) => right.count - left.count);
}

export function dailySeries(
  start: Date,
  days: number,
  orders: DashboardOrder[],
) {
  const points = Array.from({ length: days }, (_, index) => ({ date: dayKey(addDays(start, index)), orderValue: 0, revenue: 0, orders: 0 }));
  const byDate = new Map(points.map((point) => [point.date, point]));
  for (const order of orders) {
    const point = byDate.get(dayKey(order.createdAt));
    if (!point) continue;
    point.orders += 1;
    if (countsTowardsOrderValue(order)) point.orderValue += Number(order.total.toString());
    if (order.paymentStatus === PaymentStatus.PAID) point.revenue += Number(order.total.toString());
  }
  return points.map((point) => ({ ...point, orderValue: point.orderValue.toFixed(3), revenue: point.revenue.toFixed(3) }));
}

export function lowStockItems(
  products: Array<{ id: string; name: string; slug: string; sku: string | null; stock: number; variants: Array<{ id: string; name: string; sku: string; stock: number }> }>,
  threshold: number,
) {
  return products.flatMap((product) => product.variants.length
    ? product.variants.filter((variant) => variant.stock <= threshold).map((variant) => ({ id: variant.id, productId: product.id, name: `${product.name} — ${variant.name}`, slug: product.slug, sku: variant.sku, stock: variant.stock }))
    : product.stock <= threshold ? [{ id: product.id, productId: product.id, name: product.name, slug: product.slug, sku: product.sku, stock: product.stock }] : [])
    .sort((left, right) => left.stock - right.stock)
    .slice(0, 10);
}
