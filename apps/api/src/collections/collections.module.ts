import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { CollectionsController } from "./collections.controller.js";
import { CollectionsService } from "./collections.service.js";

@Module({ imports: [AuthModule], controllers: [CollectionsController], providers: [CollectionsService] })
export class CollectionsModule {}
