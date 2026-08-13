import { describe, expect, it } from "vitest";
import { FulfillmentStatus, PaymentMethod, PaymentStatus } from "../src/generated/prisma/enums.js";
import { changePercent, dailySeries, distribution, isCashOnDeliveryPending } from "../src/analytics/dashboard-metrics.js";

describe("dashboard metrics", () => {
  it("calculates comparisons without inventing an infinite percentage", () => {
    expect(changePercent(120, 100)).toBe(20);
    expect(changePercent(0, 0)).toBe(0);
    expect(changePercent(25, 0)).toBeNull();
  });

  it("aggregates paid revenue and all orders by day", () => {
    const start = new Date(2026, 7, 1);
    const series = dailySeries(start, 2, [
      { createdAt: new Date(2026, 7, 1, 9), total: 15, paymentStatus: PaymentStatus.PAID, fulfillmentStatus: FulfillmentStatus.DELIVERED },
      { createdAt: new Date(2026, 7, 1, 11), total: 7, paymentStatus: PaymentStatus.PENDING, fulfillmentStatus: FulfillmentStatus.NEW, payments: [{ method: PaymentMethod.CASH_ON_DELIVERY }] },
    ]);

    expect(series[0]).toMatchObject({ orderValue: "22.000", revenue: "15.000", orders: 2 });
    expect(series[1]).toMatchObject({ orderValue: "0.000", revenue: "0.000", orders: 0 });
  });

  it("identifies only pending cash-on-delivery amounts", () => {
    expect(isCashOnDeliveryPending({
      paymentStatus: PaymentStatus.PENDING,
      fulfillmentStatus: FulfillmentStatus.NEW,
      payments: [{ method: PaymentMethod.CASH_ON_DELIVERY }],
    })).toBe(true);
    expect(isCashOnDeliveryPending({
      paymentStatus: PaymentStatus.PAID,
      fulfillmentStatus: FulfillmentStatus.DELIVERED,
      payments: [{ method: PaymentMethod.CASH_ON_DELIVERY }],
    })).toBe(false);
  });

  it("orders distributions from the largest segment", () => {
    expect(distribution(["NEW", "DONE", "NEW"])).toEqual([{ key: "NEW", count: 2 }, { key: "DONE", count: 1 }]);
  });
});
