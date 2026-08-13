import { ConfigService } from "@nestjs/config";
import { isAbsolute, resolve } from "node:path";

export type StorageConfig =
  | { driver: "local"; localDirectory: string; publicPath: string; maxBytes: number }
  | {
      driver: "s3";
      endpoint: string;
      bucket: string;
      region: string;
      accessKey: string;
      secretKey: string;
      publicUrl: string;
      forcePathStyle: boolean;
      maxBytes: number;
    };

export function getStorageConfig(config: ConfigService): StorageConfig {
  const driver = config.getOrThrow<"local" | "s3">("STORAGE_DRIVER");
  const maxBytes = config.getOrThrow<number>("MAX_UPLOAD_BYTES");
  if (driver === "local") {
    const configuredDirectory = config.getOrThrow<string>("UPLOAD_DIR");
    const workspaceRoot = resolve(process.cwd(), "../..");
    return {
      driver,
      localDirectory: isAbsolute(configuredDirectory) ? configuredDirectory : resolve(workspaceRoot, configuredDirectory),
      publicPath: config.getOrThrow<string>("UPLOAD_PUBLIC_PATH").replace(/\/$/, ""),
      maxBytes,
    };
  }

  return {
    driver,
    endpoint: config.getOrThrow<string>("S3_ENDPOINT"),
    bucket: config.getOrThrow<string>("S3_BUCKET"),
    region: config.getOrThrow<string>("S3_REGION"),
    accessKey: config.getOrThrow<string>("S3_ACCESS_KEY"),
    secretKey: config.getOrThrow<string>("S3_SECRET_KEY"),
    publicUrl: config.getOrThrow<string>("S3_PUBLIC_URL").replace(/\/$/, ""),
    forcePathStyle: config.getOrThrow<boolean>("S3_FORCE_PATH_STYLE"),
    maxBytes,
  };
}
