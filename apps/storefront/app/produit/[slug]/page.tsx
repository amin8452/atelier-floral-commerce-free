import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@atelier/shared";
import { ProductActions } from "@/features/product/product-actions";
import { appConfig } from "@/lib/config";
import { ApiError } from "@/services/api-client";
import { getProduct } from "@/services/products";
import { getPublicSettings } from "@/services/settings";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await getProduct(slug);
    return {
      title: product.metaTitle ?? product.name,
      description: product.metaDescription ?? product.shortDescription ?? product.description?.slice(0, 160),
      alternates: { canonical: `/produit/${product.slug}` },
      openGraph: { type: "website", ...(product.images[0] ? { images: [{ url: product.images[0].url, alt: product.images[0].altText }] } : {}) },
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { title: "Produit introuvable" };
    return { title: "Produit" };
  }
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const settings = await getPublicSettings();
  let product;
  try { product = await getProduct(slug); } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const productUrl = `${appConfig.appUrl}/produit/${product.slug}`;
  const price = product.salePrice ?? product.basePrice;
  const available = product.stock > 0 || product.variants.some((variant) => variant.stock > 0);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription ?? product.description,
    sku: product.sku,
    image: product.images.map((image) => image.url),
    offers: { "@type": "Offer", price, priceCurrency: settings.defaultCurrency, availability: available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: productUrl },
  };
  return (
    <>
      <script type="application/ld+json">{JSON.stringify(structuredData).replaceAll("<", "\\u003c")}</script>
      <nav className="breadcrumbs" aria-label="Fil d'Ariane"><Link href="/">Accueil</Link><span>/</span><Link href="/boutique">Boutique</Link>{product.category && <><span>/</span><Link href={`/boutique?category=${product.category.slug}`}>{product.category.name}</Link></>}</nav>
      <section className="product-page">
        <div className="gallery">{product.images.length ? product.images.map((image) => <a key={image.id} href={image.url} target="_blank" rel="noreferrer" className="gallery-image" aria-label={`Afficher la photo de ${product.name} en grand`}><Image src={image.url} alt={image.altText || product.name} fill sizes="(max-width: 820px) calc(100vw - 32px), 48vw" /></a>) : <div className="image-empty large"><span aria-hidden="true">AF</span><small>Photo en préparation</small></div>}</div>
        <aside className="product-info">
          <p className="eyebrow">Bijou fabriqué à la main</p><h1>{product.name}</h1>
          <div className="detail-pricing">{product.salePrice && <span className="old-price">{formatMoney(product.basePrice, settings.defaultCurrency, settings.defaultLocale)}</span>}<p className="price">{formatMoney(price, settings.defaultCurrency, settings.defaultLocale)}</p></div>
          {product.shortDescription && <p className="product-lead">{product.shortDescription}</p>}
          {product.description && <p className="product-description-full">{product.description}</p>}
          <p className={`stock ${available ? "available" : "unavailable"}`}><span aria-hidden="true" />{available ? "Disponible" : "Actuellement indisponible"}</p>
          <ProductActions product={product} settings={settings} productUrl={productUrl} />
          {settings.shippingEnabled && <p className="delivery-note">La livraison est disponible. Son montant exact sera indiqué avant la confirmation de la commande.</p>}
        </aside>
      </section>
    </>
  );
}
