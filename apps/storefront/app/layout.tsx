import type { Metadata } from "next";
import { SiteFrame } from "@/components/site-frame";
import { appConfig } from "@/lib/config";
import { getPublicSettings } from "@/services/settings";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getPublicSettings();
  return {
    metadataBase: new URL(appConfig.appUrl),
    title: { default: settings.storeName, template: `%s — ${settings.storeName}` },
    description: "Bijoux en résine fabriqués à la main avec des fleurs naturelles séchées.",
    openGraph: { type: "website", siteName: settings.storeName, locale: settings.defaultLocale.replace("-", "_") },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const settings = await getPublicSettings();
  return (
    <html lang={settings.defaultLocale.split("-")[0] ?? "fr"} data-scroll-behavior="smooth">
      {/* Some browser extensions annotate body before React starts; this attribute-only change is safe to ignore. */}
      <body suppressHydrationWarning>
        <SiteFrame settings={settings}>{children}</SiteFrame>
      </body>
    </html>
  );
}
