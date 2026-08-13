import type { Metadata } from "next";
import Link from "next/link";
import { getCollections } from "@/services/taxonomies";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  let collections;
  try { collections = await getCollections(); } catch { collections = null; }
  return <section className="section"><div className="page-title"><p className="eyebrow">Sélections</p><h1>Collections</h1></div>{collections === null ? <div className="state-panel error-state">Collections momentanément indisponibles.</div> : collections.length ? <div className="collection-grid">{collections.map((collection) => <Link key={collection.id} href={`/boutique?collection=${collection.slug}`}><span>{collection.name}</span><p>{collection.description}</p><small>{collection._count.products} création{collection._count.products > 1 ? "s" : ""}</small></Link>)}</div> : <div className="state-panel">Aucune collection publiée.</div>}</section>;
}
