import "server-only";

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} must be configured`);
  return value.replace(/\/$/, "");
}

export const appConfig = {
  serverApiUrl: `${required("API_URL", process.env.API_URL)}/api`,
  appUrl: required("APP_URL", process.env.APP_URL),
  fallbackStoreName: required("STORE_NAME", process.env.STORE_NAME),
  fallbackCurrency: required("STORE_DEFAULT_CURRENCY", process.env.STORE_DEFAULT_CURRENCY),
  fallbackLocale: required("STORE_DEFAULT_LOCALE", process.env.STORE_DEFAULT_LOCALE),
} as const;
