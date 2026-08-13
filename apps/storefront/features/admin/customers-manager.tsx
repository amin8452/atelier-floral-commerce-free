"use client";

import { formatMoney } from "@atelier/shared";
import { useEffect, useState } from "react";
import { browserApi } from "@/services/api-client";
import type { AdminCustomer } from "@/types/admin";
import type { PaginationMeta, StoreSettings } from "@/types/api";
import { messageOf } from "./admin-form-utils";

type CustomerResponse = { items: AdminCustomer[]; meta: PaginationMeta };
export function CustomersManager() {
  const [items, setItems] = useState<AdminCustomer[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ pageSize: "100" });
      if (search.trim()) params.set("search", search.trim());
      Promise.all([
        browserApi<CustomerResponse>(`/customers/admin?${params}`),
        browserApi<StoreSettings>("/settings/admin"),
      ])
        .then(([result, store]) => {
          setItems(result.items);
          setSettings(store);
        })
        .catch((caught) => setError(messageOf(caught)));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [search]);
  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Relation client</p>
          <h1>Clients</h1>
        </div>
      </div>
      <div className="admin-toolbar">
        <label>
          Rechercher
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nom, email ou téléphone"
          />
        </label>
      </div>
      {error && <p className="form-message error">{error}</p>}
      <section className="admin-panel">
        {items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Contact</th>
                  <th>Commandes</th>
                  <th>Total payé</th>
                  <th>Depuis</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.firstName} {item.lastName}
                    </td>
                    <td>
                      {item.phone}
                      <small className="table-subtitle">
                        {item.email ?? "—"}
                      </small>
                    </td>
                    <td>{item._count.orders}</td>
                    <td>
                      {settings
                        ? formatMoney(
                            item.paidTotal,
                            settings.defaultCurrency,
                            settings.defaultLocale,
                          )
                        : item.paidTotal}
                    </td>
                    <td>{new Date(item.createdAt).toLocaleDateString("fr")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-empty">Aucun client.</p>
        )}
      </section>
    </>
  );
}
