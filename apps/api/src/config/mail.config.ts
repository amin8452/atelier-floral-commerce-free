import { ConfigService } from "@nestjs/config";

export type MailConfig =
  | { mode: "disabled" }
  | {
      mode: "smtp";
      host: string;
      port: number;
      secure: boolean;
      user: string;
      password: string;
      from: string;
      sellerEmail: string;
    };

export function getMailConfig(config: ConfigService): MailConfig {
  if (config.getOrThrow<"disabled" | "smtp">("EMAIL_MODE") === "disabled") {
    return { mode: "disabled" };
  }
  return {
    mode: "smtp",
    host: config.getOrThrow<string>("SMTP_HOST"),
    port: config.getOrThrow<number>("SMTP_PORT"),
    secure: config.getOrThrow<boolean>("SMTP_SECURE"),
    user: config.getOrThrow<string>("SMTP_USER"),
    password: config.getOrThrow<string>("SMTP_PASSWORD"),
    from: config.getOrThrow<string>("EMAIL_FROM"),
    sellerEmail: config.getOrThrow<string>("SELLER_NOTIFICATION_EMAIL"),
  };
}
