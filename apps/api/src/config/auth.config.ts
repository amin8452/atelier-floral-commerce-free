import { ConfigService } from "@nestjs/config";

export type AuthConfig = {
  bootstrapToken?: string;
  cookieName: string;
  secureCookie: boolean;
  sessionTtlMs: number;
  sessionPepper: string;
};

export function getAuthConfig(config: ConfigService): AuthConfig {
  const bootstrapToken = config.get<string>("ADMIN_BOOTSTRAP_TOKEN");
  return {
    ...(bootstrapToken ? { bootstrapToken } : {}),
    cookieName: config.getOrThrow<string>("SESSION_COOKIE_NAME"),
    secureCookie: config.getOrThrow<string>("NODE_ENV") === "production",
    sessionTtlMs: config.getOrThrow<number>("SESSION_TTL_HOURS") * 60 * 60 * 1000,
    sessionPepper: config.getOrThrow<string>("SESSION_SECRET"),
  };
}
