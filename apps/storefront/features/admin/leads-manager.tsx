"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { browserApi } from "@/services/api-client";
import type { AdminLead } from "@/types/admin";
import type { PaginationMeta } from "@/types/api";
import { messageOf } from "./admin-form-utils";
import { adminLabel, statusTone } from "./admin-labels";

type LeadResponse = { items: AdminLead[]; meta: PaginationMeta };

export function LeadsManager() {
  const [result, setResult] = useState<LeadResponse | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    const params = new URLSearchParams({ pageSize: "50" });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    return browserApi<LeadResponse>(`/leads/admin?${params}`)
      .then(setResult)
      .catch((caught) => setError(messageOf(caught)));
  }, [search, status]);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Relation client</p>
          <h1>Leads</h1>
        </div>
      </div>
      <div className="admin-toolbar">
        <label>
          Rechercher
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          État
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">Tous</option>
            {["NEW", "CONTACTED", "INTERESTED", "CONVERTED", "LOST"].map(
              (value) => (
                <option key={value} value={value}>{adminLabel(value)}</option>
              ),
            )}
          </select>
        </label>
      </div>
      {error && <p className="form-message error">{error}</p>}
      <section className="admin-panel">
        {result?.items.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Téléphone</th>
                  <th>Produit</th>
                  <th>Source</th>
                  <th>Préférence</th>
                  <th>État</th>
                  <th>Responsable</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((lead) => (
                  <tr key={lead.id}>
                    <td>{new Date(lead.createdAt).toLocaleDateString("fr")}</td>
                    <td>
                      <Link href={`/admin/leads/${lead.id}`}>
                        {lead.firstName} {lead.lastName}
                      </Link>
                    </td>
                    <td><a href={`tel:${lead.phone}`}>{lead.phone}</a></td>
                    <td>{lead.product?.name ?? "Contact général"}</td>
                    <td>{adminLabel(lead.source)}</td>
                    <td>{adminLabel(lead.preferredContactMethod)}</td>
                    <td>
                      <span className={`status ${statusTone(lead.status)}`}>{adminLabel(lead.status)}</span>
                    </td>
                    <td>{lead.assignedTo?.firstName ?? lead.assignedTo?.email ?? "Non assigné"}</td>
                    <td><Link href={`/admin/leads/${lead.id}`}>Ouvrir</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="admin-empty">
            {result ? "Aucun lead." : "Chargement…"}
          </p>
        )}
      </section>
    </>
  );
}
