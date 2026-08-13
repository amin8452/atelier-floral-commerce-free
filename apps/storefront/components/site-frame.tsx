"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CartProvider } from "@/features/cart/cart-provider";
import type { StoreSettings } from "@/types/api";
import { Footer } from "./footer";
import { Header } from "./header";

export function SiteFrame({
  children,
  settings,
}: {
  children: ReactNode;
  settings: StoreSettings;
}) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) return children;

  return (
    <CartProvider>
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <Header settings={settings} />
      <main id="contenu">{children}</main>
      <Footer settings={settings} />
    </CartProvider>
  );
}
