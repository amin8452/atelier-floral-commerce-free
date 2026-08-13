import { Injectable } from "@nestjs/common";
import type { Decimal } from "decimal.js";
import { PaymentMethod, PaymentProviderType, PaymentStatus } from "../generated/prisma/enums.js";
import type { PaymentCreation, PaymentProvider } from "./payment-provider.js";

@Injectable()
export class CashOnDeliveryProvider implements PaymentProvider {
  readonly method = PaymentMethod.CASH_ON_DELIVERY;

  createPending(amount: Decimal, currency: string, idempotencyKey: string): PaymentCreation {
    return {
      provider: PaymentProviderType.CASH_ON_DELIVERY,
      method: this.method,
      status: PaymentStatus.PENDING,
      amount,
      currency,
      idempotencyKey,
    };
  }
}
