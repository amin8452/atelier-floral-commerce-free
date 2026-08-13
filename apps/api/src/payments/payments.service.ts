import { BadRequestException, Injectable } from "@nestjs/common";
import type { Decimal } from "decimal.js";
import { PaymentMethod } from "../generated/prisma/enums.js";
import { CashOnDeliveryProvider } from "./cash-on-delivery.provider.js";

@Injectable()
export class PaymentsService {
  constructor(private readonly cashOnDelivery: CashOnDeliveryProvider) {}

  createPending(method: PaymentMethod, amount: Decimal, currency: string, idempotencyKey: string) {
    if (method === PaymentMethod.CASH_ON_DELIVERY) {
      return this.cashOnDelivery.createPending(amount, currency, idempotencyKey);
    }
    throw new BadRequestException("Le paiement en ligne n'est pas configuré.");
  }
}
