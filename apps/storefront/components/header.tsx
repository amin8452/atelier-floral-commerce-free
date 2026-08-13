"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/features/cart/cart-provider";
import type { StoreSettings } from "@/types/api";
import { BrandLockup } from "./brand-lockup";

const navigation = [
  { label: "Accueil", href: "/" },
  { label: "Boutique", href: "/boutique" },
  { label: "Collections", href: "/collections" },
  { label: "Nouveautés", href: "/boutique?sort=newest" },
  { label: "À propos", href: "/a-propos" },
] as const;

export function Header({ settings }: { settings: StoreSettings }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { itemCount } = useCart();
  const close = () => setOpen(false);

  return (
    <div className="storefront-header">
      <div className="announcement-bar">
        <div>
          <span>Bijoux en résine fabriqués à la main</span>
          <span>{settings.shippingEnabled ? "Livraison disponible" : "Retrait à l’atelier"}</span>
        </div>
      </div>
      <header className="site-header">
        <Link href="/" className="brand" aria-label={`Accueil — ${settings.storeName}`} onClick={close}>
          <BrandLockup storeName={settings.storeName} />
        </Link>
        <button className="mobile-menu-button" type="button" aria-expanded={open} aria-controls="main-navigation" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"} onClick={() => setOpen((value) => !value)}>
          <span aria-hidden="true"><i /><i /></span>
        </button>
        <nav id="main-navigation" className={`main-nav ${open ? "is-open" : ""}`} aria-label="Navigation principale">
          {navigation.map((item) => {
            const isActive = item.href === "/" ? pathname === "/" : !item.href.includes("?") && pathname.startsWith(item.href);
            return <Link key={item.href} onClick={close} href={item.href} aria-current={isActive ? "page" : undefined}>{item.label}</Link>;
          })}
        </nav>
        <div className="header-actions">
          <Link className="contact-link" href="/contact">Nous contacter</Link>
          <Link className="cart-link" href="/panier" aria-label={`Panier, ${itemCount} article${itemCount > 1 ? "s" : ""}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Zm3 0V6a4 4 0 0 1 8 0v2" /></svg>
            <span>Panier</span><b>{itemCount}</b>
          </Link>
        </div>
      </header>
    </div>
  );
}
