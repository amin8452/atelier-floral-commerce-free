import Link from "next/link";
import { buildStoreWhatsAppUrl } from "@/lib/whatsapp";
import type { StoreSettings } from "@/types/api";
import { BrandLockup } from "./brand-lockup";

export function Footer({ settings }: { settings: StoreSettings }) {
  const whatsappUrl = buildStoreWhatsAppUrl(settings.whatsappNumber);
  const location = [settings.address, settings.city, settings.country].filter(Boolean).join(", ");

  return (
    <footer className="site-footer">
      <div className="footer">
        <div className="footer-intro">
          <BrandLockup storeName={settings.storeName} />
          <p>Nous fabriquons à la main des bijoux en résine avec de vraies fleurs séchées.</p>
          {location && <address>{location}</address>}
        </div>
        <nav aria-label="Liens de la boutique"><strong>La boutique</strong><Link href="/boutique?sort=newest">Nouveautés</Link><Link href="/collections">Collections</Link><Link href="/boutique">Toutes les créations</Link></nav>
        <nav aria-label="Liens sur l’atelier"><strong>L’atelier</strong><Link href="/a-propos">À propos</Link><Link href="/contact">Commande sur mesure</Link><Link href="/contact">Nous contacter</Link></nav>
        <div><strong>Restons en contact</strong>{settings.supportEmail && <a href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>}{settings.instagramUrl && <a href={settings.instagramUrl} target="_blank" rel="noreferrer">Instagram</a>}{settings.facebookUrl && <a href={settings.facebookUrl} target="_blank" rel="noreferrer">Facebook</a>}{whatsappUrl && <a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a>}</div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} {settings.storeName}</span><span>Une question ? Écrivez-nous, nous vous répondrons directement.</span></div>
    </footer>
  );
}
