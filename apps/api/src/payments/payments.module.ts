import { Module } from "@nestjs/common";
import { CashOnDeliveryProvider } from "./cash-on-delivery.provider.js";
import { PaymentsService } from "./payments.service.js";

@Module({ providers: [CashOnDeliveryProvider, PaymentsService], exports: [PaymentsService] })
export class PaymentsModule {}
