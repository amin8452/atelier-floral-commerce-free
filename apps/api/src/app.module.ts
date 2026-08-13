import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { resolve } from "node:path";
import { AnalyticsModule } from "./analytics/analytics.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { CartsModule } from "./carts/carts.module.js";
import { CategoriesModule } from "./categories/categories.module.js";
import { CollectionsModule } from "./collections/collections.module.js";
import { CustomersModule } from "./customers/customers.module.js";
import { AuditModule } from "./common/audit/audit.module.js";
import { ApiExceptionFilter } from "./common/http/api-exception.filter.js";
import { PrismaModule } from "./common/prisma/prisma.module.js";
import { validateEnv } from "./config/env.js";
import { HealthModule } from "./health/health.module.js";
import { InventoryModule } from "./inventory/inventory.module.js";
import { LeadsModule } from "./leads/leads.module.js";
import { MediaModule } from "./media/media.module.js";
import { OrdersModule } from "./orders/orders.module.js";
import { ProductsModule } from "./products/products.module.js";
import { PromotionsModule } from "./promotions/promotions.module.js";
import { SettingsModule } from "./settings/settings.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuditModule,
    AuthModule,
    HealthModule,
    SettingsModule,
    CategoriesModule,
    CollectionsModule,
    CustomersModule,
    ProductsModule,
    InventoryModule,
    MediaModule,
    CartsModule,
    PromotionsModule,
    LeadsModule,
    OrdersModule,
    AnalyticsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
