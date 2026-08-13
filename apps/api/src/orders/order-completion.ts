import { FulfillmentStatus, PaymentMethod, PaymentStatus } from "../generated/prisma/enums.js";

export type OrderCompletionState = {
  fulfillmentStatus: FulfillmentStatus;
  paymentStatus: PaymentStatus;
  paymentMethods: readonly PaymentMethod[];
};

const BLOCKING_PAYMENT_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.CANCELLED,
  PaymentStatus.FAILED,
  PaymentStatus.REFUNDED,
]);

export function orderCompletionError(state: OrderCompletionState): string | null {
  if (state.fulfillmentStatus === FulfillmentStatus.CANCELLED) {
    return "Une commande annulée ne peut pas être terminée.";
  }
  if (BLOCKING_PAYMENT_STATUSES.has(state.paymentStatus)) {
    return "Le statut du paiement doit être régularisé avant de terminer cette commande.";
  }
  if (state.paymentStatus === PaymentStatus.PENDING && !state.paymentMethods.includes(PaymentMethod.CASH_ON_DELIVERY)) {
    return "Un paiement en ligne doit être confirmé par son fournisseur avant de terminer la commande.";
  }
  return null;
}

export function completedPaymentStatus(state: OrderCompletionState): PaymentStatus {
  return state.paymentStatus === PaymentStatus.PENDING && state.paymentMethods.includes(PaymentMethod.CASH_ON_DELIVERY)
    ? PaymentStatus.PAID
    : state.paymentStatus;
}
