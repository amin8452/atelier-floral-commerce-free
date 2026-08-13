"use client";

import { formatMoney } from "@atelier/shared";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { browserApi } from "@/services/api-client";
import type { AdminOrderDetail } from "@/types/admin";
import type { StoreSettings } from "@/types/api";
import { useNotifications } from "./admin-feedback";
import { messageOf } from "./admin-form-utils";
import { adminLabel } from "./admin-labels";
import { AdminPageHeader, InlineError } from "./admin-ui";
import { CompleteOrderAction } from "./complete-order-action";

const PAYMENT_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED", "CANCELLED"] as const;
const FULFILLMENT_STATUSES = ["NEW", "PROCESSING", "READY", "SHIPPED", "DELIVERED", "CANCELLED"] as const;

export function OrderDetail({ id }: { id: string }) {
  const { notify } = useNotifications();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchOrder = useCallback(() => Promise.all([
    browserApi<AdminOrderDetail>(`/orders/admin/${id}`),
    browserApi<StoreSettings>("/settings/admin"),
  ]), [id]);

  const load = useCallback(async () => {
    try {
      const [item, store] = await fetchOrder();
      setOrder(item);
      setSettings(store);
      setError(null);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }, [fetchOrder]);

  useEffect(() => {
    let active = true;
    void fetchOrder()
      .then(([item, store]) => { if (active) { setOrder(item); setSettings(store); setError(null); } })
      .catch((caught) => { if (active) setError(messageOf(caught)); });
    return () => { active = false; };
  }, [fetchOrder]);

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const note = String(data.get("note") ?? "").trim();
    try {
      await browserApi(`/orders/admin/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          paymentStatus: String(data.get("paymentStatus")),
          fulfillmentStatus: String(data.get("fulfillmentStatus")),
          ...(note ? { note } : {}),
        }),
      });
      await load();
      notify({ title: "Commande mise à jour", message: "Les nouveaux états sont enregistrés dans l’historique." });
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  if (error && !order) return <p className="admin-panel error-state">{error}</p>;
  if (!order || !settings) return <p className="admin-panel">Chargement…</p>;
  const money = (value: string) => formatMoney(value, order.currency, settings.defaultLocale);

  return (
    <>
      <AdminPageHeader
        eyebrow="Commande"
        title={order.orderNumber}
        description={new Date(order.createdAt).toLocaleString("fr")}
        action={<CompleteOrderAction order={order} onCompleted={load} />}
      />
      <InlineError message={error} />
      <div className="admin-two-columns">
        <section className="admin-panel detail-list">
          <h2>Client et livraison</h2>
          <p><strong>Client</strong>{order.customerSnapshot.firstName} {order.customerSnapshot.lastName}</p>
          <p><strong>Téléphone</strong>{order.customerSnapshot.phone}</p>
          <p><strong>Email</strong>{order.customerSnapshot.email ?? "Non renseigné"}</p>
          <p><strong>Adresse</strong>{[order.shippingAddress.line1, order.shippingAddress.line2, order.shippingAddress.postalCode, order.shippingAddress.city, order.shippingAddress.country].filter(Boolean).join(", ")}</p>
          <p><strong>Paiement</strong>{adminLabel(order.payments[0]?.method)} · {adminLabel(order.paymentStatus)}</p>
          {order.notes && <p><strong>Note client</strong>{order.notes}</p>}
        </section>
        <section className="admin-panel">
          <h2>Mettre à jour</h2>
          <p className="admin-panel-description">Enregistrez le paiement et l’avancement réel de la préparation.</p>
          <form className="admin-form" key={`${order.paymentStatus}-${order.fulfillmentStatus}`} onSubmit={update}>
            <label><span>État du paiement</span><select name="paymentStatus" defaultValue={order.paymentStatus}>{PAYMENT_STATUSES.map((value) => <option key={value} value={value}>{adminLabel(value)}</option>)}</select></label>
            <label><span>Avancement de la commande</span><select name="fulfillmentStatus" defaultValue={order.fulfillmentStatus}>{FULFILLMENT_STATUSES.map((value) => <option key={value} value={value}>{adminLabel(value)}</option>)}</select></label>
            <label><span>Note interne</span><textarea name="note" maxLength={1000} placeholder="Facultatif" /></label>
            <button className="button" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer les changements"}</button>
          </form>
        </section>
      </div>
      <section className="admin-panel">
        <h2>Articles</h2>
        <div className="table-scroll"><table><thead><tr><th>Produit</th><th>Prix</th><th>Qté</th><th>Total</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id}><td>{item.productNameSnapshot}<small className="table-subtitle">{item.variantSnapshot?.name ?? item.skuSnapshot}</small></td><td>{money(item.unitPrice)}</td><td>{item.quantity}</td><td>{money(item.total)}</td></tr>)}</tbody></table></div>
        <dl className="order-totals"><div><dt>Sous-total</dt><dd>{money(order.subtotal)}</dd></div><div><dt>Remise</dt><dd>− {money(order.discount)}</dd></div><div><dt>Livraison</dt><dd>{money(order.shipping)}</dd></div><div><dt>Taxe</dt><dd>{money(order.tax)}</dd></div><div><dt>Total</dt><dd>{money(order.total)}</dd></div></dl>
      </section>
      <section className="admin-panel">
        <h2>Historique</h2>
        <ol className="timeline">{order.activities.map((activity) => <li key={activity.id}><strong>{adminLabel(activity.fulfillmentStatus ?? activity.paymentStatus ?? "NOTE")}</strong><span>{new Date(activity.createdAt).toLocaleString("fr")}</span>{activity.note && <p>{activity.note}</p>}</li>)}</ol>
      </section>
    </>
  );
}
