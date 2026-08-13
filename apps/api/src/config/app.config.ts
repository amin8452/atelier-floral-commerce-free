import { ConfigService } from "@nestjs/config";

export type RuntimeAppConfig = {
  nodeEnv: "development" | "test" | "production";
  port: number;
  appUrl: string;
  apiUrl: string;
  corsOrigins: string[];
  trustProxy: boolean;
};

export function getAppConfig(config: ConfigService): RuntimeAppConfig {
  const origins = config
    .getOrThrow<string>("CORS_ORIGINS")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0 || origins.includes("*")) {
    throw new Error("CORS_ORIGINS must contain explicit origins");
  }

  return {
    nodeEnv: config.getOrThrow<RuntimeAppConfig["nodeEnv"]>("NODE_ENV"),
    port: config.getOrThrow<number>("PORT"),
    appUrl: config.getOrThrow<string>("APP_URL"),
    apiUrl: config.getOrThrow<string>("API_URL"),
    corsOrigins: origins,
    trustProxy: config.getOrThrow<boolean>("TRUST_PROXY"),
  };
}
