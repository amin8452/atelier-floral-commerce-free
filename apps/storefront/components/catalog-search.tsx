"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { browserApi } from "@/services/api-client";
import type { ProductListItem, ProductListResponse } from "@/types/api";

export function CatalogSearch({ defaultValue = "" }: { defaultValue?: string }) {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState(defaultValue);
  const [suggestions, setSuggestions] = useState<ProductListItem[]>([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ search: term, available: "true", pageSize: "5" });
      void browserApi<ProductListResponse>(`/products?${params}`, { signal: controller.signal })
        .then((response) => setSuggestions(response.items))
        .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setSuggestions([]); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);

  const showSuggestions = focused && query.trim().length >= 2;
  return (
    <div className="catalog-search" onFocus={() => setFocused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <label htmlFor={inputId}>
        <span>Que recherchez-vous ?</span>
        <span className="catalog-search-input">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></svg>
          <input id={inputId} name="search" type="search" value={query} onChange={(event) => { const value = event.target.value; setQuery(value); if (value.trim().length < 2) { setSuggestions([]); setLoading(false); } }} placeholder="Collier fleuri, boucles dorées, référence…" autoComplete="off" role="combobox" aria-expanded={showSuggestions} aria-controls={listId} />
          {query && <button type="button" onClick={() => { setQuery(""); setSuggestions([]); setLoading(false); }} aria-label="Effacer la recherche">×</button>}
        </span>
      </label>
      <button className="btn primary catalog-search-submit" type="submit">Rechercher</button>
      {showSuggestions && (
        <div className="catalog-suggestions" id={listId} role="listbox">
          {loading ? <p>Recherche…</p> : suggestions.length ? suggestions.map((product) => (
            <Link key={product.id} href={`/produit/${product.slug}`} role="option">
              <strong>{product.name}</strong>
              <span>{product.shortDescription ?? "Voir la fiche de cette création"}</span>
            </Link>
          )) : <p>Aucune suggestion. Lancez la recherche pour voir tous les résultats.</p>}
        </div>
      )}
    </div>
  );
}
