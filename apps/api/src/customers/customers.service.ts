import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "../generated/prisma/client.js";
import { PaymentStatus } from "../generated/prisma/enums.js";
import { paginationMeta } from "../common/pagination/pagination.dto.js";
import { PrismaService } from "../common/prisma/prisma.service.js";
import type { CustomerQueryDto } from "./customer.dto.js";

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CustomerQueryDto) {
    const term = query.search?.trim();
    const where: Prisma.CustomerWhereInput = term
      ? {
          OR: [
            { firstName: { contains: term, mode: "insensitive" } },
            { lastName: { contains: term, mode: "insensitive" } },
            { email: { contains: term, mode: "insensitive" } },
            { phone: { contains: term } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          createdAt: true,
          _count: { select: { orders: true, addresses: true } },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);
    const paidTotals = await this.prisma.order.groupBy({
      by: ["customerId"],
      where: { customerId: { in: items.map((item) => item.id) }, paymentStatus: PaymentStatus.PAID },
      _sum: { total: true },
    });
    return {
      items: items.map((customer) => ({
        ...customer,
        paidTotal: paidTotals.find((entry) => entry.customerId === customer.id)?._sum.total?.toFixed(3) ?? "0.000",
      })),
      meta: paginationMeta(query.page, query.pageSize, total),
    };
  }

  async get(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: { orderBy: { createdAt: "desc" } },
        orders: {
          orderBy: { createdAt: "desc" },
          select: { id: true, orderNumber: true, total: true, currency: true, paymentStatus: true, fulfillmentStatus: true, createdAt: true },
        },
      },
    });
    if (!customer) throw new NotFoundException("Client introuvable.");
    return customer;
  }
}
