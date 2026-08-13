"use client";

import { formatMoney } from "@atelier/shared";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { getStoredCartToken, useCart } from "@/features/cart/cart-provider";
import { browserApi } from "@/services/api-client";
import type { StoreSettings } from "@/types/api";

type CheckoutResponse = { orderNumber: string; currency: string; total: string; paymentStatus: string; fulfillmentStatus: string; createdAt: string };

export function CheckoutForm({ settings }: { settings: StoreSettings }) {
  const { cart, refresh } = useCart();
  const router = useRouter();
  const idempotencyKey = useRef(crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getStoredCartToken();
    if (!token) { setError("Votre panier n'est pas disponible."); return; }
    setSubmitting(true); setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const result = await browserApi<CheckoutResponse>("/orders/checkout", {
        method: "POST",
        headers: { "x-cart-token": token, "idempotency-key": idempotencyKey.current },
        body: JSON.stringify({
          customer: { firstName: data.get("firstName"), lastName: data.get("lastName"), phone: data.get("phone"), email: data.get("email") || undefined },
          shippingAddress: { line1: data.get("line1"), line2: data.get("line2") || undefined, city: data.get("city"), postalCode: data.get("postalCode") || undefined, country: data.get("country") },
          notes: data.get("notes") || undefined,
          promotionCode: data.get("promotionCode") || undefined,
          paymentMethod: "CASH_ON_DELIVERY",
        }),
      });
      window.sessionStorage.setItem("atelier.order." + result.orderNumber, JSON.stringify(result));
      await refresh();
      router.push("/commande/confirmation?numero=" + encodeURIComponent(result.orderNumber));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La commande n'a pas pu être créée.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!cart || cart.items.length === 0) {
    return <section className="section narrow"><div className="state-panel"><h1>Votre panier est vide.</h1><p>Ajoutez au moins une création avant de commander.</p></div></section>;
  }

  return (
    <section className="section checkout-page">
      <div className="page-title"><p className="eyebrow">Finaliser</p><h1>Commande</h1></div>
      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={submit}>
          <fieldset>
            <legend>Vos coordonnées</legend>
            <div className="form-grid"><label className="field"><span>Prénom</span><input name="firstName" autoComplete="given-name" required maxLength={80} /></label><label className="field"><span>Nom</span><input name="lastName" autoComplete="family-name" required maxLength={80} /></label></div>
            <div className="form-grid"><label className="field"><span>Téléphone</span><input name="phone" type="tel" autoComplete="tel" required maxLength={40} /></label><label className="field"><span>Email</span><input name="email" type="email" autoComplete="email" maxLength={254} /></label></div>
          </fieldset>
          <fieldset>
            <legend>Livraison</legend>
            <label className="field"><span>Adresse</span><input name="line1" autoComplete="address-line1" required maxLength={220} /></label>
            <label className="field"><span>Complément</span><input name="line2" autoComplete="address-line2" maxLength={220} /></label>
            <div className="form-grid"><label className="field"><span>Ville</span><input name="city" autoComplete="address-level2" required maxLength={120} /></label><label className="field"><span>Code postal</span><input name="postalCode" autoComplete="postal-code" maxLength={30} /></label></div>
            <label className="field"><span>Pays (code ISO)</span><input name="country" autoComplete="country" required minLength={2} maxLength={2} defaultValue={settings.country ?? ""} /></label>
          </fieldset>
          <fieldset>
            <legend>Paiement</legend>
            {settings.codEnabled ? <label className="radio-field"><input type="radio" checked readOnly /><span>Paiement à la livraison</span></label> : <p className="form-error">Aucune méthode de paiement n’est actuellement disponible.</p>}
          </fieldset>
          <label className="field"><span>Code promotionnel</span><input name="promotionCode" maxLength={80} /></label>
          <label className="field"><span>Notes</span><textarea name="notes" rows={4} maxLength={2000} /></label>
          <button className="btn primary" type="submit" disabled={submitting || !settings.codEnabled}>{submitting ? "Création de la commande…" : "Confirmer la commande"}</button>
          {error && <p className="form-error" role="alert">{error}</p>}
        </form>
        <aside className="checkout-summary"><h2>Votre panier</h2>{cart.items.map((item) => <div key={item.id}><span>{item.name} × {item.quantity}</span><strong>{formatMoney(item.lineTotal, cart.currency, cart.locale)}</strong></div>)}<div className="checkout-subtotal"><span>Sous-total</span><strong>{formatMoney(cart.subtotal, cart.currency, cart.locale)}</strong></div><p>Le montant final, incluant livraison, promotion et taxes, est calculé par le serveur.</p></aside>
      </div>
    </section>
  );
}
