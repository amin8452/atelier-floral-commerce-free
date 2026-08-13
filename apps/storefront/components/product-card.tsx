import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@atelier/shared";
import type { ProductListItem } from "@/types/api";
import { ProductCardAction } from "./product-card-action";

export function ProductCard({ product, currency, locale }: { product: ProductListItem; currency: string; locale: string }) {
  const image = product.images[0];
  const productHref = `/produit/${product.slug}`;
  return (
    <article className="product-card">
      <Link href={productHref} className="product-image" aria-label={`Découvrir ${product.name}`}>
        {image
          ? <Image src={image.url} alt={image.altText || product.name} fill sizes="(max-width: 520px) 100vw, (max-width: 900px) 50vw, 25vw" />
          : <div className="image-empty"><span aria-hidden="true">AF</span><small>Photo en préparation</small></div>}
        <span className="product-card-badges">
          {product.salePrice && <b>Prix doux</b>}
          {product.stock <= 0 && <b className="muted">Épuisé</b>}
        </span>
      </Link>
      <div className="product-meta">
        <div><h3><Link href={productHref}>{product.name}</Link></h3>{product.shortDescription && <p className="product-description">{product.shortDescription}</p>}</div>
        <div className="product-pricing">
          {product.salePrice && <span className="old-price">{formatMoney(product.basePrice, currency, locale)}</span>}
          <p>{formatMoney(product.salePrice ?? product.basePrice, currency, locale)}</p>
        </div>
      </div>
      <div className="product-card-actions">
        <Link className="product-discover-link" href={productHref}>Voir la création <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11M11 6l4 4-4 4" /></svg></Link>
        <ProductCardAction productId={product.id} productHref={productHref} available={product.stock > 0} canQuickOrder={product.canQuickOrder} />
      </div>
    </article>
  );
}
