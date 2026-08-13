import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller.js";
import { ProductsService } from "./products.service.js";
import { AuthModule } from "../auth/auth.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { ProductDeletionService } from "./product-deletion.service.js";

@Module({ imports: [AuthModule, NotificationsModule], controllers: [ProductsController], providers: [ProductsService, ProductDeletionService], exports: [ProductsService] })
export class ProductsModule {}
