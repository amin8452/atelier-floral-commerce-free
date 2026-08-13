import type { Metadata } from "next";
import Link from "next/link";
import { CatalogError } from "@/components/catalog-error";
import { ProductCard } from "@/components/product-card";
import { CatalogSearch } from "@/components/catalog-search";
import { getProducts, type ProductFilters } from "@/services/products";
import { getPublicSettings } from "@/services/settings";
import { getCategories, getCollections } from "@/services/taxonomies";

export const metadata: Metadata = { title: "Boutique", description: "Découvrez les bijoux et créations florales disponibles." };

export default async function ShopPage({ searchParams }: { searchParams: Promise<ProductFilters> }) {
  const filters = await searchParams;
  const settings = await getPublicSettings();
  const [productsResult, categoriesResult, collectionsResult] = await Promise.allSettled([getProducts(filters), getCategories(), getCollections()]);
  const response = productsResult.status === "fulfilled" ? productsResult.value : null;
  const categories = categoriesResult.status === "fulfilled" ? categoriesResult.value : [];
  const collections = collectionsResult.status === "fulfilled" ? collectionsResult.value : [];
  const hasFilters = Boolean(filters.search || filters.category || filters.collection || filters.minPrice || filters.maxPrice || filters.available || (filters.sort && filters.sort !== "newest"));
  return (
    <section className="section shop">
      <div className="page-title"><p className="eyebrow">Catalogue</p><h1>Boutique</h1><p>Recherchez une création et affinez les résultats selon vos envies.</p></div>
      <form className="shop-filters" method="get">
        <CatalogSearch defaultValue={filters.search ?? ""} />
        <div className="shop-filter-grid">
          <label><span>Catégorie</span><select name="category" defaultValue={filters.category ?? ""}><option value="">Toutes</option>{categories.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
          <label><span>Collection</span><select name="collection" defaultValue={filters.collection ?? ""}><option value="">Toutes</option>{collections.map((item) => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
          <label><span>Prix minimum</span><input name="minPrice" inputMode="decimal" defaultValue={filters.minPrice} placeholder="0" /></label>
          <label><span>Prix maximum</span><input name="maxPrice" inputMode="decimal" defaultValue={filters.maxPrice} placeholder="Sans limite" /></label>
          <label><span>Trier par</span><select name="sort" defaultValue={filters.sort ?? "newest"}><option value="newest">Nouveautés</option><option value="price_asc">Prix croissant</option><option value="price_desc">Prix décroissant</option><option value="popular">Popularité</option></select></label>
          <label className="checkbox-label"><input name="available" type="checkbox" value="true" defaultChecked={filters.available === "true"} /><span>Uniquement en stock</span></label>
          <button className="btn secondary" type="submit">Appliquer les filtres</button>
          {hasFilters && <Link className="shop-filter-reset" href="/boutique">Tout réinitialiser</Link>}
        </div>
      </form>
      {!response
        ? <CatalogError />
        : response.items.length
          ? <><p className="result-count">{response.meta.total} résultat{response.meta.total > 1 ? "s" : ""}</p><div className="product-grid">{response.items.map((product) => <ProductCard key={product.id} product={product} currency={settings.defaultCurrency} locale={settings.defaultLocale} />)}</div><Pagination filters={filters} page={response.meta.page} pageCount={response.meta.pageCount} /></>
          : <div className="state-panel"><h2>Aucun produit ne correspond.</h2><p>Modifiez les filtres ou revenez à l’ensemble de la boutique.</p><Link className="btn secondary" href="/boutique">Réinitialiser</Link></div>}
    </section>
  );
}

function Pagination({ filters, page, pageCount }: { filters: ProductFilters; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  const href = (target: number) => {
    const params = new URLSearchParams(Object.entries(filters).flatMap(([key, value]) => value ? [[key, value]] : []));
    params.set("page", String(target));
    return `/boutique?${params}`;
  };
  return <nav className="pagination" aria-label="Pagination">{page > 1 && <Link href={href(page - 1)}>Précédent</Link>}<span>Page {page} sur {pageCount}</span>{page < pageCount && <Link href={href(page + 1)}>Suivant</Link>}</nav>;
}
