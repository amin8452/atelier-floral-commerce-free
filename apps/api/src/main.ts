import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { mkdir } from "node:fs/promises";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { getAppConfig } from "./config/app.config.js";
import { getStorageConfig } from "./config/storage.config.js";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const appConfig = getAppConfig(config);
  const storage = getStorageConfig(config);

  if (appConfig.trustProxy) app.set("trust proxy", 1);
  app.setGlobalPrefix("api");
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "no-referrer" },
    }),
  );
  app.enableCors({ origin: appConfig.corsOrigins, credentials: true, methods: ["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"] });
  if (storage.driver === "local") {
    await mkdir(storage.localDirectory, { recursive: true });
    app.useStaticAssets(storage.localDirectory, { prefix: `${storage.publicPath}/`, immutable: true, maxAge: "30d", index: false });
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.enableShutdownHooks();
  await app.listen(appConfig.port, "0.0.0.0");
  new Logger("Bootstrap").log(`API ready on port ${appConfig.port}`);
}

void bootstrap();
