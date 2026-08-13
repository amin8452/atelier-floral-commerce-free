"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { browserApi } from "@/services/api-client";
import type { InventoryProduct } from "@/types/admin";
import type { PaginationMeta } from "@/types/api";
import { useNotifications } from "./admin-feedback";
import { messageOf } from "./admin-form-utils";
import { AdminPageHeader, InlineError } from "./admin-ui";

type InventoryResponse = { items: InventoryProduct[]; threshold: number; meta: PaginationMeta };

export function InventoryManager() {
  const { notify } = useNotifications();
  const [result, setResult] = useState<InventoryResponse | null>(null);
  const [lowOnly, setLowOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ pageSize: "100", lowStockOnly: String(lowOnly) });
      if (appliedSearch) params.set("search", appliedSearch);
      const data = await browserApi<InventoryResponse>(`/inventory/admin?${params}`);
      setResult(data);
      setError(null);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }, [appliedSearch, lowOnly]);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ pageSize: "100", lowStockOnly: String(lowOnly) });
    if (appliedSearch) params.set("search", appliedSearch);
    void browserApi<InventoryResponse>(`/inventory/admin?${params}`)
      .then((data) => { if (active) { setResult(data); setError(null); } })
      .catch((caught) => { if (active) setError(messageOf(caught)); });
    return () => { active = false; };
  }, [appliedSearch, lowOnly]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(search.trim());
  }

  async function save(product: InventoryProduct, variantId: string | undefined, stock: number) {
    const key = variantId ?? product.id;
    setSavingKey(key);
    try {
      await browserApi("/inventory/admin/stock", {
        method: "PATCH",
        body: JSON.stringify({ productId: product.id, ...(variantId ? { variantId } : {}), stock }),
      });
      notify({ title: "Stock mis à jour", message: `${product.name} dispose maintenant de ${stock} unité(s) sur cette référence.` });
      await load();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Stocks"
        description="Une seule source de vérité : stock global pour un produit simple, quantités détaillées pour un produit à variantes."
      />
      <form className="admin-toolbar inventory-toolbar" onSubmit={submitSearch}>
        <label className="inventory-search"><span>Rechercher</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Produit ou référence SKU" /></label>
        <button className="button secondary" type="submit">Rechercher</button>
        <label className="checkbox inventory-low-filter"><input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} /><span>Uniquement les alertes</span></label>
        {result && <span className="inventory-threshold">Seuil d’alerte : ≤ {result.threshold}</span>}
      </form>
      <InlineError message={error} />
      <section className="inventory-catalog" aria-live="polite">
        {result?.items.map((product) => {
          const activeVariants = product.variants.filter((variant) => variant.isActive);
          const variantMode = activeVariants.length > 0;
          return (
            <article className="admin-panel inventory-product" key={product.id}>
              <header className="inventory-product-head">
                <div>
                  <span className={`stock-level ${product.stock <= result.threshold ? "low" : "healthy"}`}>{product.stock <= result.threshold ? "Stock faible" : "Disponible"}</span>
                  <h2>{product.name}</h2>
                  <p>{product.sku ?? "Sans référence principale"}</p>
                </div>
                <div className="inventory-total"><strong>{product.stock}</strong><span>unités au total</span></div>
              </header>
              {variantMode ? (
                <div className="inventory-variants">
                  <div className="inventory-mode-note"><strong>Gestion par variante</strong><span>Le total se recalcule automatiquement après chaque modification.</span></div>
                  {product.variants.map((variant) => (
                    <StockEditor
                      key={`${variant.id}:${variant.stock}`}
                      label={variant.name}
                      sku={variant.sku}
                      value={variant.stock}
                      threshold={result.threshold}
                      disabled={!variant.isActive || savingKey !== null}
                      inactive={!variant.isActive}
                      busy={savingKey === variant.id}
                      onSave={(stock) => save(product, variant.id, stock)}
                    />
                  ))}
                </div>
              ) : (
                <div className="inventory-simple-stock">
                  <div className="inventory-mode-note"><strong>Gestion globale</strong><span>Cette quantité est utilisée directement pour la disponibilité du produit.</span></div>
                  <StockEditor
                    key={`${product.id}:${product.stock}`}
                    label="Quantité disponible"
                    sku={product.sku ?? "Stock principal"}
                    value={product.stock}
                    threshold={result.threshold}
                    disabled={savingKey !== null}
                    busy={savingKey === product.id}
                    onSave={(stock) => save(product, undefined, stock)}
                  />
                </div>
              )}
            </article>
          );
        })}
        {result && !result.items.length && <div className="admin-panel admin-empty"><strong>Aucun stock trouvé</strong><span>Modifiez vos filtres ou ajoutez un produit au catalogue.</span></div>}
        {!result && !error && <div className="admin-panel admin-loading-panel">Chargement des stocks…</div>}
      </section>
    </>
  );
}

function StockEditor({
  value,
  label,
  sku,
  threshold,
  disabled,
  inactive = false,
  busy,
  onSave,
}: {
  value: number;
  label: string;
  sku: string;
  threshold: number;
  disabled: boolean;
  inactive?: boolean;
  busy: boolean;
  onSave: (value: number) => Promise<void>;
}) {
  const [stock, setStock] = useState(value);
  const changed = stock !== value;
  return (
    <div className={`stock-editor ${inactive ? "inactive" : ""}`}>
      <div><strong>{label}</strong><span>{sku}{inactive ? " · inactive" : ""}</span></div>
      <span className={`stock-level compact ${value <= threshold ? "low" : "healthy"}`}>{value <= threshold ? "À surveiller" : "Correct"}</span>
      <label><span>Nouvelle quantité</span><input type="number" min={0} max={10_000_000} value={stock} onChange={(event) => setStock(Math.max(0, Number(event.target.value)))} disabled={disabled} /></label>
      <button className="button secondary" type="button" disabled={disabled || !changed} onClick={() => void onSave(stock)}>{busy ? "Mise à jour…" : "Mettre à jour"}</button>
    </div>
  );
}
