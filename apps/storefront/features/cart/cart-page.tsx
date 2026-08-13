"use client";

import { formatMoney } from "@atelier/shared";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "./cart-provider";

export function CartPage() {
  const { cart, loading, error, updateItem, removeItem } = useCart();
  return (
    <section className="section cart-page">
      <div className="page-title"><p className="eyebrow">Votre sélection</p><h1>Panier</h1></div>
      {loading && !cart ? <div className="state-panel">Chargement du panier…</div> : !cart || cart.items.length === 0 ? <div className="state-panel"><h2>Votre panier est vide.</h2><Link className="btn primary" href="/boutique">Découvrir la boutique</Link></div> : <div className="cart-layout"><div className="cart-items">{cart.items.map((item) => <article className="cart-item" key={item.id}>{item.image && <div className="cart-item-image"><Image src={item.image.url} alt={item.image.altText} fill sizes="120px" /></div>}<div><h2><Link href={`/produit/${item.slug}`}>{item.name}</Link></h2>{item.variantName && <p>{item.variantName}</p>}{item.personalization && Object.entries(item.personalization).map(([key, value]) => <small key={key}>{key} : {value}</small>)}</div><label className="field quantity-field"><span>Quantité</span><input type="number" min={1} max={Math.min(item.availableStock, 100)} value={item.quantity} disabled={loading} onChange={(event) => void updateItem(item.id, Number(event.target.value))} /></label><strong>{formatMoney(item.lineTotal, cart.currency, cart.locale)}</strong><button className="text-button" type="button" disabled={loading} onClick={() => void removeItem(item.id)}>Retirer</button></article>)}</div><aside className="cart-summary"><h2>Récapitulatif</h2><div><span>Sous-total</span><strong>{formatMoney(cart.subtotal, cart.currency, cart.locale)}</strong></div><p>Livraison, remise et taxes sont recalculées au checkout.</p><Link className="btn primary" href="/commande">Commander</Link></aside></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </section>
  );
}
