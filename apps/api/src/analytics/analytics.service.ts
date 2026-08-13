import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AnalyticsEventType, FulfillmentStatus, LeadStatus, PaymentStatus, ProductStatus } from "../generated/prisma/enums.js";
import { paginationMeta } from "../common/pagination/pagination.dto.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import type { CreateAnalyticsEventDto, ProductPerformanceQueryDto } from "./analytics.dto.js";
import { addDays, changePercent, countsTowardsOrderValue, dailySeries, dayKey, distribution, isCashOnDeliveryPending, lowStockItems, sumTotals } from "./dashboard-metrics.js";

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async recordPublic(dto: CreateAnalyticsEventDto) {
    const product = await this.prisma.product.findFirst({ where: { id: dto.productId, status: ProductStatus.ACTIVE }, select: { id: true } });
    if (!product) throw new NotFoundException("Produit introuvable.");
    await this.prisma.analyticsEvent.create({
      data: { type: dto.type, productId: dto.productId, sessionId: dto.sessionId?.trim() || null },
    });
    return { success: true };
  }

  async dashboard(days = 30) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const month = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentStart = addDays(today, -(days - 1));
    const previousStart = addDays(currentStart, -days);
    const lowStockThreshold = this.config.getOrThrow<number>("LOW_STOCK_THRESHOLD");
    const recognizedOrderWhere = {
      fulfillmentStatus: { not: FulfillmentStatus.CANCELLED },
      paymentStatus: { notIn: [PaymentStatus.CANCELLED, PaymentStatus.FAILED, PaymentStatus.REFUNDED] },
    };
    const [todayRevenue, monthRevenue, todayOrderValue, monthOrderValue, periodOrders, pendingOrders, newLeads, periodLeads, lowStockCandidates, recentOrders] = await this.prisma.$transaction([
      this.prisma.order.aggregate({ where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: today } }, _sum: { total: true } }),
      this.prisma.order.aggregate({ where: { paymentStatus: PaymentStatus.PAID, createdAt: { gte: month } }, _sum: { total: true } }),
      this.prisma.order.aggregate({ where: { ...recognizedOrderWhere, createdAt: { gte: today } }, _sum: { total: true } }),
      this.prisma.order.aggregate({ where: { ...recognizedOrderWhere, createdAt: { gte: month } }, _sum: { total: true } }),
      this.prisma.order.findMany({
        where: { createdAt: { gte: previousStart } },
        select: { createdAt: true, total: true, paymentStatus: true, fulfillmentStatus: true, payments: { select: { method: true } } },
      }),
      this.prisma.order.count({ where: { fulfillmentStatus: { in: [FulfillmentStatus.NEW, FulfillmentStatus.PROCESSING] } } }),
      this.prisma.lead.count({ where: { status: LeadStatus.NEW } }),
      this.prisma.lead.findMany({ where: { createdAt: { gte: previousStart } }, select: { createdAt: true, status: true } }),
      this.prisma.product.findMany({
        where: {
          status: ProductStatus.ACTIVE,
          OR: [{ stock: { lte: lowStockThreshold } }, { variants: { some: { isActive: true, stock: { lte: lowStockThreshold } } } }],
        },
        orderBy: { stock: "asc" },
        take: 100,
        select: { id: true, name: true, slug: true, sku: true, stock: true, variants: { where: { isActive: true }, select: { id: true, name: true, sku: true, stock: true } } },
      }),
      this.prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, orderNumber: true, total: true, paymentStatus: true, fulfillmentStatus: true, createdAt: true },
      }),
    ]);

    const currentOrders = periodOrders.filter((order) => order.createdAt >= currentStart);
    const previousOrders = periodOrders.filter((order) => order.createdAt < currentStart);
    const currentLeads = periodLeads.filter((lead) => lead.createdAt >= currentStart);
    const previousLeads = periodLeads.filter((lead) => lead.createdAt < currentStart);
    const currentPaid = currentOrders.filter((order) => order.paymentStatus === PaymentStatus.PAID);
    const previousPaid = previousOrders.filter((order) => order.paymentStatus === PaymentStatus.PAID);
    const currentRecognized = currentOrders.filter(countsTowardsOrderValue);
    const previousRecognized = previousOrders.filter(countsTowardsOrderValue);
    const revenue = sumTotals(currentPaid);
    const previousRevenue = sumTotals(previousPaid);
    const orderValue = sumTotals(currentRecognized);
    const previousOrderValue = sumTotals(previousRecognized);
    const cashOnDeliveryPending = sumTotals(currentOrders.filter(isCashOnDeliveryPending));
    const averageBasket = currentRecognized.length ? orderValue / currentRecognized.length : 0;
    const previousAverageBasket = previousRecognized.length ? previousOrderValue / previousRecognized.length : 0;

    return {
      revenueToday: todayRevenue._sum.total?.toFixed(3) ?? "0.000",
      revenueMonth: monthRevenue._sum.total?.toFixed(3) ?? "0.000",
      orderValueToday: todayOrderValue._sum.total?.toFixed(3) ?? "0.000",
      orderValueMonth: monthOrderValue._sum.total?.toFixed(3) ?? "0.000",
      orderCountMonth: currentOrders.length,
      pendingOrders,
      newLeads,
      periodLeadCount: currentLeads.length,
      averageBasket: averageBasket.toFixed(3),
      period: { days, from: dayKey(currentStart), to: dayKey(today) },
      periodRevenue: revenue.toFixed(3),
      periodOrderValue: orderValue.toFixed(3),
      cashOnDeliveryPending: cashOnDeliveryPending.toFixed(3),
      comparisons: {
        revenue: changePercent(revenue, previousRevenue),
        orderValue: changePercent(orderValue, previousOrderValue),
        orders: changePercent(currentOrders.length, previousOrders.length),
        averageBasket: changePercent(averageBasket, previousAverageBasket),
        leads: changePercent(currentLeads.length, previousLeads.length),
      },
      salesSeries: dailySeries(currentStart, days, currentOrders),
      fulfillmentDistribution: distribution(currentOrders.map((order) => order.fulfillmentStatus)),
      leadDistribution: distribution(currentLeads.map((lead) => lead.status)),
      lowStockProducts: lowStockItems(lowStockCandidates, lowStockThreshold),
      recentOrders: recentOrders.map((order) => ({ ...order, total: order.total.toFixed(3) })),
    };
  }

  async productPerformance(query: ProductPerformanceQueryDto) {
    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: { id: true, name: true, slug: true },
      }),
      this.prisma.product.count(),
    ]);
    const productIds = products.map((product) => product.id);
    const [events, sales] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ["productId", "type"],
        where: { productId: { in: productIds } },
        _count: { _all: true },
      }),
      this.prisma.orderItem.groupBy({
        by: ["productId"],
        where: { productId: { in: productIds }, order: { paymentStatus: PaymentStatus.PAID } },
        _count: { _all: true },
        _sum: { quantity: true, total: true },
      }),
    ]);
    return {
      items: products.map((product) => {
        const eventCount = (type: AnalyticsEventType) => events.find((event) => event.productId === product.id && event.type === type)?._count._all ?? 0;
        const sale = sales.find((entry) => entry.productId === product.id);
        const views = eventCount(AnalyticsEventType.PRODUCT_VIEW);
        const orders = sale?._count._all ?? 0;
        return {
          ...product,
          views,
          addToCart: eventCount(AnalyticsEventType.ADD_TO_CART),
          leads: eventCount(AnalyticsEventType.LEAD_CREATED),
          whatsappClicks: eventCount(AnalyticsEventType.WHATSAPP_CLICK),
          orders,
          unitsSold: sale?._sum.quantity ?? 0,
          revenue: sale?._sum.total?.toFixed(3) ?? "0.000",
          conversionRate: views > 0 ? Number(((orders / views) * 100).toFixed(2)) : 0,
        };
      }),
      meta: paginationMeta(query.page, query.pageSize, total),
    };
  }
}
