import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module.js";
import { getStorageConfig } from "../config/storage.config.js";
import { MediaController } from "./media.controller.js";
import { MediaService } from "./media.service.js";
import { LocalStorageProvider } from "./storage/local-storage.provider.js";
import { S3StorageProvider } from "./storage/s3-storage.provider.js";
import { STORAGE_PROVIDER } from "./storage/storage-provider.js";

@Module({
  imports: [AuthModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        getStorageConfig(config).driver === "local" ? new LocalStorageProvider(config) : new S3StorageProvider(config),
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
