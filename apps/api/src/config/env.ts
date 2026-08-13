import { z } from "zod";

const optionalTrimmedString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional(),
);

const booleanString = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

function containsOnlyWebOrigins(value: string): boolean {
  const origins = value.split(",").map((origin) => origin.trim()).filter(Boolean);
  return origins.length > 0 && origins.every((origin) => {
    try {
      const url = new URL(origin);
      return (url.protocol === "http:" || url.protocol === "https:") && url.origin === origin;
    } catch {
      return false;
    }
  });
}

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    DATABASE_URL: z.string().min(1),
    APP_URL: z.string().url(),
    API_URL: z.string().url(),
    SESSION_SECRET: z.string().min(32),
    SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(12),
    SESSION_COOKIE_NAME: z.string().regex(/^[a-zA-Z0-9_-]+$/).default("atelier_admin_session"),
    ADMIN_BOOTSTRAP_TOKEN: optionalTrimmedString,
    CORS_ORIGINS: z.string().min(1).refine(containsOnlyWebOrigins, "must be a comma-separated list of HTTP(S) origins"),
    TRUST_PROXY: booleanString.default(false),
    STORE_NAME: z.string().trim().min(1).max(160),
    STORE_DEFAULT_CURRENCY: z.string().regex(/^[A-Z]{3}$/),
    STORE_DEFAULT_LOCALE: z.string().trim().min(2).max(20),
    STORE_SHIPPING_FLAT_RATE: z.coerce.number().min(0).default(0),
    STORE_TAX_RATE: z.coerce.number().min(0).max(1).default(0),
    CONSENT_POLICY_VERSION: z.string().trim().min(1).max(40),
    CART_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    LOW_STOCK_THRESHOLD: z.coerce.number().int().min(0).max(1000000).default(5),
    STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
    UPLOAD_DIR: z.string().min(1).default("data/uploads"),
    UPLOAD_PUBLIC_PATH: z.string().regex(/^\/[A-Za-z0-9/_-]*$/).default("/uploads"),
    MAX_UPLOAD_BYTES: z.coerce.number().int().min(1024).max(25 * 1024 * 1024).default(5 * 1024 * 1024),
    S3_ENDPOINT: optionalTrimmedString,
    S3_BUCKET: optionalTrimmedString,
    S3_REGION: optionalTrimmedString.default("auto"),
    S3_ACCESS_KEY: optionalTrimmedString,
    S3_SECRET_KEY: optionalTrimmedString,
    S3_PUBLIC_URL: optionalTrimmedString.pipe(z.string().url().optional()),
    S3_FORCE_PATH_STYLE: booleanString.default(true),
    EMAIL_MODE: z.enum(["disabled", "smtp"]).default("disabled"),
    SMTP_HOST: optionalTrimmedString,
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_SECURE: booleanString.default(false),
    SMTP_USER: optionalTrimmedString,
    SMTP_PASSWORD: optionalTrimmedString,
    EMAIL_FROM: optionalTrimmedString,
    SELLER_NOTIFICATION_EMAIL: optionalTrimmedString,
    PAYMENT_MODE: z.literal("cash_on_delivery").default("cash_on_delivery"),
    WHATSAPP_NUMBER: optionalTrimmedString.refine((value) => !value || /^\+?[0-9][0-9\s().-]{5,38}$/.test(value), "must be a valid international phone number"),
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_MODE === "smtp") {
      for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "EMAIL_FROM", "SELLER_NOTIFICATION_EMAIL"] as const) {
        if (!env[key]) {
          ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when EMAIL_MODE=smtp` });
        }
      }
    }

    if (env.STORAGE_DRIVER === "s3") {
      for (const key of ["S3_ENDPOINT", "S3_BUCKET", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_PUBLIC_URL"] as const) {
        if (!env[key]) {
          ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when STORAGE_DRIVER=s3` });
        }
      }
    }

    if (env.NODE_ENV === "production" && env.SESSION_SECRET === "replace-with-at-least-32-random-characters") {
      ctx.addIssue({ code: "custom", path: ["SESSION_SECRET"], message: "SESSION_SECRET must be replaced in production" });
    }
  });

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return result.data;
}
