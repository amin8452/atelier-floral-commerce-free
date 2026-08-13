"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { browserApi } from "@/services/api-client";
import type { AdminProduct, AdminProductResponse } from "@/types/admin";
import { useNotifications } from "./admin-feedback";
import { messageOf } from "./admin-form-utils";
import { adminLabel, PRODUCT_STATUS_VALUES } from "./admin-labels";
import { useAdmin } from "./admin-shell";
import { AdminPageHeader, ConfirmDialog, InlineError } from "./admin-ui";

export function ProductsManager() {
  const { notify } = useNotifications();
  const currentAdmin = useAdmin();
  const [result, setResult] = useState<AdminProductResponse | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [archiveTarget, setArchiveTarget] = useState<AdminProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminProduct | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const load = useCallback(async (page = 1) => {
    const params = productParams(search, status, page);
    try {
      setResult(await browserApi<AdminProductResponse>(`/products/admin?${params}`));
      setError(null);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }, [search, status]);

  useEffect(() => {
    let active = true;
    const params = productParams(search, status, 1);
    void browserApi<AdminProductResponse>(`/products/admin?${params}`)
      .then((value) => { if (active) { setResult(value); setError(null); } })
      .catch((caught) => { if (active) setError(messageOf(caught)); });
    return () => { active = false; };
  }, [search, status]);

  async function duplicate(product: AdminProduct) {
    setBusy(true);
    try {
      await browserApi(`/products/admin/${product.id}/duplicate`, { method: "POST" });
      await load();
      notify({ title: "Produit dupliqué", message: `Une copie en brouillon de « ${product.name} » a été créée.` });
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!archiveTarget) return;
    setBusy(true);
    try {
      await browserApi(`/products/admin/${archiveTarget.id}`, { method: "DELETE" });
      const productName = archiveTarget.name;
      setArchiveTarget(null);
      await load();
      notify({ title: "Produit archivé", message: `${productName} n’est plus visible dans la boutique.`, tone: "info" });
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function scheduleDeletion() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const scheduled = await browserApi<{ deletionScheduledFor: string; notificationSent: boolean }>(`/products/admin/${deleteTarget.id}/deletion`, { method: "DELETE" });
      const productName = deleteTarget.name;
      setDeleteTarget(null);
      await load();
      notify({
        title: "Suppression programmée",
        message: `« ${productName} » sera supprimé le ${formatDeletionDate(scheduled.deletionScheduledFor)}. Vous pouvez annuler pendant 24 heures.`,
        tone: "warning",
      });
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function cancelDeletion(product: Pick<AdminProduct, "id" | "name">) {
    setBusy(true);
    try {
      await browserApi(`/products/admin/${product.id}/deletion/cancel`, { method: "POST" });
      await load();
      notify({ title: "Suppression annulée", message: `« ${product.name} » reste archivé et ne sera pas supprimé.`, tone: "info" });
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(product: AdminProduct, nextStatus: string) {
    if (nextStatus === product.status) return;
    if (nextStatus === "ARCHIVED") {
      setArchiveTarget(product);
      return;
    }

    setStatusBusyId(product.id);
    try {
      await browserApi(`/products/admin/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      await load(result?.meta.page ?? 1);
      notify({
        title: nextStatus === "ACTIVE" ? "Produit publié" : "Produit passé en brouillon",
        message: nextStatus === "ACTIVE"
          ? `« ${product.name} » est maintenant visible dans la boutique.`
          : `« ${product.name} » n’est plus visible dans la boutique.`,
        tone: nextStatus === "ACTIVE" ? "success" : "info",
      });
    } catch (caught) {
      const message = messageOf(caught);
      setError(message);
      notify({ title: "Changement d’état impossible", message, tone: "error" });
    } finally {
      setStatusBusyId(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Produits"
        description="Gérez les fiches, les prix, les variantes et leur publication depuis un éditeur guidé."
        action={<Link className="button" href="/admin/produits/nouveau">Ajouter un produit</Link>}
      />

      {result && result.scheduledDeletions.length > 0 && (
        <section className="product-deletion-notice" role="status">
          <div className="product-deletion-notice-icon" aria-hidden="true">!</div>
          <div className="product-deletion-notice-content">
            <strong>{result.scheduledDeletions.length} suppression(s) automatique(s) programmée(s)</strong>
            <p>Chaque produit reste récupérable pendant 24 heures. L’administrateur est averti ici et par email lorsque SMTP est configuré.</p>
            <div>{result.scheduledDeletions.map((product) => <span key={product.id}><b>{product.name}</b><small>{formatDeletionDate(product.deletionScheduledFor)}</small><button type="button" disabled={busy} onClick={() => void cancelDeletion(product)}>Annuler</button></span>)}</div>
          </div>
        </section>
      )}

      <div className="admin-toolbar">
        <label><span>Rechercher</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom ou référence SKU" /></label>
        <label><span>État</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tous les états</option><option value="DRAFT">Brouillons</option><option value="ACTIVE">Publiés</option><option value="ARCHIVED">Archivés</option></select></label>
      </div>
      <InlineError message={error} />

      <section className="admin-panel">
        {result?.items.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Produit</th><th>SKU</th><th>Prix</th><th>Stock</th><th>État</th><th>Actions</th></tr></thead>
              <tbody>
                {result.items.map((product) => (
                  <tr key={product.id}>
                    <td><Link href={`/admin/produits/${product.id}`}><strong>{product.name}</strong></Link><small className="table-subtitle">{product.category?.name ?? "Sans catégorie"}</small></td>
                    <td>{product.sku ?? "—"}</td>
                    <td>{product.salePrice ?? product.basePrice}</td>
                    <td>{product.stock}</td>
                    <td>{product.deletionScheduledFor ? <div className="scheduled-deletion-state"><span className="status muted">Corbeille</span><small>Suppression le {formatDeletionDate(product.deletionScheduledFor)}</small></div> : <label className="product-status-control"><span className="sr-only">État de {product.name}</span><select value={product.status} disabled={busy || statusBusyId === product.id} onChange={(event) => void changeStatus(product, event.target.value)}>{PRODUCT_STATUS_VALUES.map((value) => <option key={value} value={value}>{adminLabel(value)}</option>)}</select>{statusBusyId === product.id && <small>Mise à jour…</small>}</label>}</td>
                    <td className="table-actions">
                      {!product.deletionScheduledFor && <Link href={`/admin/produits/${product.id}`}>Modifier</Link>}
                      {!product.deletionScheduledFor && <button type="button" disabled={busy} onClick={() => void duplicate(product)}>Dupliquer</button>}
                      {product.status === "ARCHIVED" && !product.deletionScheduledFor && ["SUPER_ADMIN", "ADMIN"].includes(currentAdmin.role) && <button className="danger-text" type="button" onClick={() => setDeleteTarget(product)}>Supprimer</button>}
                      {product.deletionScheduledFor && ["SUPER_ADMIN", "ADMIN"].includes(currentAdmin.role) && <button type="button" disabled={busy} onClick={() => void cancelDeletion(product)}>Annuler la suppression</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="admin-empty">{result ? "Aucun produit ne correspond aux filtres." : "Chargement…"}</p>}
      </section>

      {result && result.meta.pageCount > 1 && (
        <div className="pagination">
          <button disabled={result.meta.page <= 1} onClick={() => void load(result.meta.page - 1)}>Précédent</button>
          <span>Page {result.meta.page} / {result.meta.pageCount}</span>
          <button disabled={result.meta.page >= result.meta.pageCount} onClick={() => void load(result.meta.page + 1)}>Suivant</button>
        </div>
      )}

      <ConfirmDialog
        open={archiveTarget !== null}
        title="Archiver ce produit ?"
        message={archiveTarget ? `« ${archiveTarget.name} » ne sera plus visible dans la boutique. Ses commandes et données historiques seront conservées.` : ""}
        confirmLabel="Archiver le produit"
        destructive
        busy={busy}
        onClose={() => !busy && setArchiveTarget(null)}
        onConfirm={() => void archive()}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Mettre ce produit à la corbeille ?"
        message={deleteTarget ? `« ${deleteTarget.name} » sera conservé pendant 24 heures avant sa suppression définitive. Une alerte restera visible et vous pourrez annuler pendant ce délai.` : ""}
        confirmLabel="Confirmer la suppression"
        destructive
        busy={busy}
        onClose={() => !busy && setDeleteTarget(null)}
        onConfirm={() => void scheduleDeletion()}
      />
    </>
  );
}

function formatDeletionDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function productParams(search: string, status: string, page: number) {
  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (search.trim()) params.set("search", search.trim());
  if (status) params.set("status", status);
  return params;
}
