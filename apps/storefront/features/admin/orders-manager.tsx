"use client";

import { formatMoney } from "@atelier/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { browserApi } from "@/services/api-client";
import type { AdminOrder } from "@/types/admin";
import type { PaginationMeta, StoreSettings } from "@/types/api";
import { adminLabel, statusTone } from "./admin-labels";
import { AdminPageHeader, InlineError } from "./admin-ui";
import { CompleteOrderAction } from "./complete-order-action";
import { messageOf } from "./admin-form-utils";

type OrderResponse = { items: AdminOrder[]; meta: PaginationMeta };

export function OrdersManager() {
  const [orders, setOrders] = useState<OrderResponse | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      setOrders(await browserApi<OrderResponse>("/orders/admin?pageSize=100"));
      setError(null);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      browserApi<OrderResponse>("/orders/admin?pageSize=100"),
      browserApi<StoreSettings>("/settings/admin"),
    ])
      .then(([orderResponse, store]) => { setOrders(orderResponse); setSettings(store); })
      .catch((caught) => setError(messageOf(caught)));
  }, []);

  return (
    <>
      <AdminPageHeader
        eyebrow="Ventes"
        title="Commandes"
        description="Suivez les paiements, la préparation et terminez une commande directement depuis la liste."
      />
      <InlineError message={error} />
      <section className="admin-panel">
        {orders?.items.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Commande</th><th>Client</th><th>Total</th><th>Paiement</th><th>Traitement</th><th>Date</th><th>Action</th></tr></thead>
              <tbody>
                {orders.items.map((order) => (
                  <tr key={order.id}>
                    <td><Link href={`/admin/commandes/${order.id}`}>{order.orderNumber}</Link><small className="table-subtitle">{order._count.items} article(s)</small></td>
                    <td>{order.customerSnapshot.firstName} {order.customerSnapshot.lastName}<small className="table-subtitle">{order.customerSnapshot.phone}</small></td>
                    <td>{settings ? formatMoney(order.total, order.currency, settings.defaultLocale) : order.total}</td>
                    <td><span className={`status ${statusTone(order.paymentStatus)}`}>{adminLabel(order.paymentStatus)}</span><small className="table-subtitle">{adminLabel(order.payments[0]?.method)}</small></td>
                    <td><span className={`status ${statusTone(order.fulfillmentStatus)}`}>{adminLabel(order.fulfillmentStatus)}</span></td>
                    <td>{new Date(order.createdAt).toLocaleString("fr")}</td>
                    <td><CompleteOrderAction order={order} compact onCompleted={loadOrders} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="admin-empty">{orders ? "Aucune commande." : "Chargement…"}</p>}
      </section>
    </>
  );
}
