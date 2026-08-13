"use client";

import { formatMoney } from "@atelier/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { browserApi } from "@/services/api-client";
import type { DashboardMetrics } from "@/types/admin";
import type { StoreSettings } from "@/types/api";
import { DonutChart, TrendChart } from "./admin-charts";
import { messageOf } from "./admin-form-utils";
import { adminLabel, statusTone } from "./admin-labels";
import { AdminPageHeader, InlineError } from "./admin-ui";

const PERIODS = [7, 30, 90] as const;

export function AdminDashboard() {
  const [days, setDays] = useState<number>(30);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void browserApi<StoreSettings>("/settings/admin").then(setSettings).catch((caught) => setError(messageOf(caught)));
  }, []);

  useEffect(() => {
    let active = true;
    void browserApi<DashboardMetrics>(`/analytics/admin/dashboard?days=${days}`)
      .then((data) => { if (active) { setMetrics(data); setError(null); } })
      .catch((caught) => { if (active) setError(messageOf(caught)); });
    return () => { active = false; };
  }, [days]);

  const money = (value: string | number) => settings
    ? formatMoney(value, settings.defaultCurrency, settings.defaultLocale)
    : String(value);

  return (
    <>
      <AdminPageHeader
        eyebrow="Pilotage"
        title="Vue d’ensemble"
        description="Suivez les ventes, les opérations et les opportunités depuis une vue consolidée."
        action={(
          <label className="dashboard-period"><span>Période analysée</span><select value={days} onChange={(event) => { setError(null); setDays(Number(event.target.value)); }}>{PERIODS.map((period) => <option key={period} value={period}>{period} jours</option>)}</select></label>
        )}
      />
      <InlineError message={error} />
      {!metrics || !settings ? <div className="admin-panel admin-loading-panel">Chargement des indicateurs…</div> : (
        <>
          <div className="dashboard-kpis">
            <Kpi label={`Valeur des commandes · ${days} j`} value={money(metrics.periodOrderValue)} change={metrics.comparisons.orderValue} note={`Dont ${money(metrics.cashOnDeliveryPending)} à encaisser à la livraison`} accent="green" />
            <Kpi label={`Montant encaissé · ${days} j`} value={money(metrics.periodRevenue)} change={metrics.comparisons.revenue} note="Paiements réellement confirmés" accent="blue" />
            <Kpi label={`Commandes · ${days} j`} value={String(metrics.orderCountMonth)} change={metrics.comparisons.orders} accent="blue" />
            <Kpi label="Panier moyen" value={money(metrics.averageBasket)} change={metrics.comparisons.averageBasket} accent="gold" />
            <Kpi label={`Nouveaux prospects · ${days} j`} value={String(metrics.periodLeadCount)} change={metrics.comparisons.leads} accent="purple" />
            <Kpi label="Commandes à traiter" value={String(metrics.pendingOrders)} note="Nouvelles ou en préparation" accent="orange" />
          </div>

          <div className="dashboard-chart-grid">
            <section className="admin-panel dashboard-chart-card dashboard-trend-card">
              <div className="dashboard-card-head"><div><p className="eyebrow">Ventes</p><h2>Évolution de la valeur des commandes</h2><p>Les paiements à la livraison sont inclus ; les montants encaissés restent affichés séparément.</p></div><span>{shortDate(metrics.period.from)} — {shortDate(metrics.period.to)}</span></div>
              <TrendChart points={metrics.salesSeries.map((point) => ({ label: shortDate(point.date), value: Number(point.orderValue) }))} formatValue={money} />
            </section>
            <section className="admin-panel dashboard-chart-card">
              <div className="dashboard-card-head"><div><p className="eyebrow">Opérations</p><h2>État des commandes</h2></div></div>
              <DonutChart data={metrics.fulfillmentDistribution.map((item) => ({ label: adminLabel(item.key), value: item.count }))} emptyLabel="Aucune commande sur cette période." />
            </section>
            <section className="admin-panel dashboard-chart-card">
              <div className="dashboard-card-head"><div><p className="eyebrow">Relation client</p><h2>État des prospects</h2></div></div>
              <DonutChart data={metrics.leadDistribution.map((item) => ({ label: adminLabel(item.key), value: item.count }))} emptyLabel="Aucun prospect sur cette période." />
            </section>
          </div>

          <div className="dashboard-bottom-grid">
            <section className="admin-panel">
              <div className="admin-panel-head"><div><p className="eyebrow">À surveiller</p><h2>Stock faible</h2></div><Link href="/admin/stocks">Gérer les stocks</Link></div>
              {metrics.lowStockProducts.length ? <div className="dashboard-list">{metrics.lowStockProducts.map((product) => <Link href={`/admin/produits/${product.productId}`} key={product.id}><div><strong>{product.name}</strong><span>{product.sku ?? "Sans SKU"}</span></div><b className="stock-alert-value">{product.stock}</b></Link>)}</div> : <p className="admin-empty">Aucune alerte de stock.</p>}
            </section>
            <section className="admin-panel">
              <div className="admin-panel-head"><div><p className="eyebrow">Activité récente</p><h2>Dernières commandes</h2></div><Link href="/admin/commandes">Voir toutes</Link></div>
              {metrics.recentOrders.length ? <div className="dashboard-list orders">{metrics.recentOrders.map((order) => <Link href={`/admin/commandes/${order.id}`} key={order.id}><div><strong>{order.orderNumber}</strong><span>{shortDate(order.createdAt)} · {adminLabel(order.fulfillmentStatus)}</span></div><div className="dashboard-order-value"><b>{money(order.total)}</b><span className={`status ${statusTone(order.paymentStatus)}`}>{adminLabel(order.paymentStatus)}</span></div></Link>)}</div> : <p className="admin-empty">Aucune commande récente.</p>}
            </section>
          </div>
        </>
      )}
    </>
  );
}

function Kpi({ label, value, change, note, accent }: { label: string; value: string; change?: number | null; note?: string; accent: string }) {
  return (
    <article className={`dashboard-kpi accent-${accent}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {change === null ? <small className="neutral">Nouvelle activité sur la période</small> : change !== undefined ? <small className={change >= 0 ? "positive" : "negative"}>{change >= 0 ? "↗" : "↘"} {Math.abs(change)} % vs période précédente</small> : null}
      {note && <small className="neutral kpi-note">{note}</small>}
    </article>
  );
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

export function AdminState({ title, message, error = false }: { title: string; message: string; error?: boolean }) {
  return <><div className="admin-page-head"><h1>{title}</h1></div><div className={`admin-panel ${error ? "error-state" : ""}`}>{message}</div></>;
}
