import { ConfigService } from "@nestjs/config";

export function getPaymentConfig(config: ConfigService) {
  return { mode: config.getOrThrow<"cash_on_delivery">("PAYMENT_MODE") } as const;
}
