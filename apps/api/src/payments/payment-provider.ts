import type { Decimal } from "decimal.js";
import type { PaymentMethod, PaymentProviderType, PaymentStatus } from "../generated/prisma/enums.js";

export type PaymentCreation = {
  provider: PaymentProviderType;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: Decimal;
  currency: string;
  idempotencyKey: string;
};

export interface PaymentProvider {
  readonly method: PaymentMethod;
  createPending(amount: Decimal, currency: string, idempotencyKey: string): PaymentCreation;
}
