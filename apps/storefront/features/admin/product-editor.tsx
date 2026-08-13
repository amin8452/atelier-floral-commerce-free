"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { browserApi } from "@/services/api-client";
import { imageName, uploadMediaAsset } from "@/services/media-upload";
import type { AdminMedia, AdminProductDetail, TaxonomyAdmin } from "@/types/admin";
import type { PaginationMeta } from "@/types/api";
import { useNotifications } from "./admin-feedback";
import { messageOf, toSlug } from "./admin-form-utils";
import { adminLabel, PRODUCT_STATUS_VALUES } from "./admin-labels";
import { AdminDialog } from "./admin-ui";

type VariantOptionDraft = { name: string; value: string };
type VariantDraft = {
  id?: string;
  name: string;
  sku: string;
  price: string;
  salePrice: string;
  stock: number;
  isActive: boolean;
  options: VariantOptionDraft[];
};
type PersonalizationDraft = { key: string; label: string; required: boolean; maxLength: number };
type MediaResponse = { items: AdminMedia[]; meta: PaginationMeta };

export function ProductEditor({ id }: { id?: string }) {
  const router = useRouter();
  const { notify } = useNotifications();
  const [product, setProduct] = useState<AdminProductDetail | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [simpleStock, setSimpleStock] = useState(0);
  const [slugTouched, setSlugTouched] = useState(Boolean(id));
  const [categories, setCategories] = useState<TaxonomyAdmin[]>([]);
  const [collections, setCollections] = useState<TaxonomyAdmin[]>([]);
  const [media, setMedia] = useState<AdminMedia[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [personalizations, setPersonalizations] = useState<PersonalizationDraft[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const closeEditor = useCallback(() => router.push("/admin/produits"), [router]);

  useEffect(() => {
    Promise.all([
      browserApi<TaxonomyAdmin[]>("/categories/admin"),
      browserApi<TaxonomyAdmin[]>("/collections/admin"),
      browserApi<MediaResponse>("/media/admin?pageSize=100"),
    ])
      .then(([cats, cols, assets]) => {
        setCategories(cats);
        setCollections(cols);
        setMedia(assets.items);
      })
      .catch((caught) => setError(messageOf(caught)));

    if (!id) return;
    browserApi<AdminProductDetail>(`/products/admin/${id}`)
      .then((item) => {
        setProduct(item);
        setName(item.name);
        setSlug(item.slug);
        setSimpleStock(item.stock);
        setSelectedMedia(item.images.sort((left, right) => left.sortOrder - right.sortOrder).map((image) => image.assetId));
        setVariants(item.variants.map(toVariantDraft));
        setPersonalizations(toPersonalizationDrafts(item.personalizationSchema));
      })
      .catch((caught) => setError(messageOf(caught)));
  }, [id]);

  const selectedAssets = useMemo(
    () => selectedMedia.flatMap((assetId) => {
      const asset = media.find((candidate) => candidate.id === assetId);
      return asset ? [asset] : [];
    }),
    [media, selectedMedia],
  );
  const activeVariants = useMemo(() => variants.filter((variant) => variant.isActive), [variants]);
  const variantStock = useMemo(
    () => activeVariants.reduce((total, variant) => total + Math.max(0, variant.stock), 0),
    [activeVariants],
  );
  const hasVariants = variants.length > 0;

  function changeName(value: string) {
    setName(value);
    if (!slugTouched) setSlug(toSlug(value));
  }

  function updateVariant(index: number, patch: Partial<VariantDraft>) {
    setVariants((current) => current.map((variant, position) => position === index ? { ...variant, ...patch } : variant));
  }

  function updateVariantOption(variantIndex: number, optionIndex: number, patch: Partial<VariantOptionDraft>) {
    setVariants((current) => current.map((variant, position) => position === variantIndex
      ? { ...variant, options: variant.options.map((option, currentOption) => currentOption === optionIndex ? { ...option, ...patch } : option) }
      : variant));
  }

  function updatePersonalization(index: number, patch: Partial<PersonalizationDraft>) {
    setPersonalizations((current) => current.map((field, position) => position === index ? { ...field, ...patch } : field));
  }

  function moveMedia(index: number, direction: -1 | 1) {
    setSelectedMedia((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
      return reordered;
    });
  }

  function toggleMedia(assetId: string) {
    setSelectedMedia((current) => current.includes(assetId) ? current.filter((value) => value !== assetId) : [...current, assetId]);
  }

  function updateMediaAlt(assetId: string, altText: string) {
    setMedia((current) => current.map((asset) => asset.id === assetId ? { ...asset, altText } : asset));
  }

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    setError(null);
    setUploadProgress(0);
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        if (!file) continue;
        const prefix = files.length > 1 ? (index / files.length) * 100 : 0;
        const asset = await uploadMediaAsset(
          file,
          name.trim() ? `${name.trim()} — ${imageName(file.name)}` : imageName(file.name),
          (progress) => setUploadProgress(Math.round(prefix + progress / files.length)),
        );
        setMedia((current) => [asset, ...current.filter((item) => item.id !== asset.id)]);
        setSelectedMedia((current) => current.includes(asset.id) ? current : [...current, asset.id]);
      }
      setUploadProgress(100);
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setUploading(false);
    }
  }

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    void uploadFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }

  function acceptDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void uploadFiles(Array.from(event.dataTransfer.files));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const personalizationSchema = Object.fromEntries(personalizations
        .filter((field) => field.key.trim() && field.label.trim())
        .map((field) => [toSlug(field.key), { label: field.label.trim(), required: field.required, maxLength: field.maxLength }]));
      const body = {
        name: name.trim(),
        slug: slug.trim(),
        sku: nullable(data, "sku"),
        shortDescription: text(data, "shortDescription"),
        description: text(data, "description"),
        basePrice: text(data, "basePrice"),
        salePrice: nullable(data, "salePrice"),
        stock: hasVariants ? variantStock : simpleStock,
        status: text(data, "status"),
        categoryId: nullable(data, "categoryId"),
        collectionIds: data.getAll("collectionIds").map(String),
        tags: text(data, "tags").split(",").map((tag) => tag.trim()).filter(Boolean),
        personalizationSchema,
        metaTitle: text(data, "metaTitle"),
        metaDescription: text(data, "metaDescription"),
        variants: variants.map((variant) => ({
          ...(variant.id ? { id: variant.id } : {}),
          name: variant.name.trim(),
          sku: variant.sku.trim(),
          options: Object.fromEntries(variant.options.filter((option) => option.name.trim() && option.value.trim()).map((option) => [option.name.trim(), option.value.trim()])),
          price: variant.price || null,
          salePrice: variant.salePrice || null,
          stock: variant.stock,
          isActive: variant.isActive,
        })),
        images: selectedMedia.map((assetId, sortOrder) => ({
          assetId,
          altText: media.find((asset) => asset.id === assetId)?.altText.trim() || name.trim(),
          sortOrder,
          isPrimary: sortOrder === 0,
        })),
      };
      const saved = await browserApi<AdminProductDetail>(id ? `/products/admin/${id}` : "/products/admin", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      notify({
        title: id ? "Produit modifié" : "Produit créé",
        message: `${saved.name} a été enregistré avec succès.`,
      });
      router.replace("/admin/produits");
      router.refresh();
    } catch (caught) {
      setError(messageOf(caught));
      document.querySelector<HTMLElement>(".admin-dialog-body")?.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  if (id && !product && !error) {
    return <AdminDialog open title="Chargement du produit" description="Préparation de l’éditeur…" size="fullscreen" onClose={closeEditor}><p className="admin-panel admin-loading-panel">Chargement du produit…</p></AdminDialog>;
  }

  return (
    <AdminDialog
      open
      title={id ? "Modifier le produit" : "Ajouter un produit"}
      description="Complétez chaque section, puis enregistrez. Vous retrouverez ensuite la liste des produits."
      size="fullscreen"
      onClose={closeEditor}
      footer={(
        <div className="product-editor-footer">
          <span>{selectedAssets.length ? `${selectedAssets.length} photo(s)` : "Aucune photo"} · {variants.length ? `${variants.length} variante(s)` : "Sans variante"}</span>
          <div>
            <button className="button secondary" type="button" onClick={closeEditor} disabled={busy}>Annuler</button>
            <button className="button" type="submit" form="product-editor-form" disabled={busy || uploading}>{busy ? "Enregistrement…" : id ? "Enregistrer les modifications" : "Créer le produit"}</button>
          </div>
        </div>
      )}
    >
      <nav className="product-editor-steps" aria-label="Étapes de la fiche produit">
        <a href="#product-essential"><span>1</span>Essentiel</a>
        <a href="#product-description"><span>2</span>Description</a>
        <a href="#product-photos"><span>3</span>Photos</a>
        <a href="#product-variants"><span>4</span>Variantes</a>
        <a href="#product-personalization"><span>5</span>Personnalisation</a>
      </nav>
      {error && <p className="form-message error" role="alert">{error}</p>}
      <form className="admin-form product-editor" id="product-editor-form" onSubmit={submit} key={product?.id ?? "new"}>
        <section className="admin-panel product-essential-panel" id="product-essential">
          <div className="admin-section-title"><span>1</span><div><h2>Essentiel commercial</h2><p>Les informations nécessaires pour identifier, vendre et publier le produit.</p></div></div>
          <div className="form-grid">
            <label><span>Nom du produit *</span><input name="name" required maxLength={180} value={name} onChange={(event) => changeName(event.target.value)} placeholder="Ex. Bouquet Harmonie" /></label>
            <label><span>État de publication</span><select name="status" defaultValue={product?.status ?? "DRAFT"}>{PRODUCT_STATUS_VALUES.map((value) => <option key={value} value={value}>{adminLabel(value)}{value === "DRAFT" ? " — invisible" : value === "ACTIVE" ? " — visible" : ""}</option>)}</select></label>
            <label><span>Prix normal *</span><input name="basePrice" required inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,3})?" defaultValue={product?.basePrice ?? "0.000"} /></label>
            <label><span>Prix promotionnel</span><input name="salePrice" inputMode="decimal" pattern="[0-9]+(?:\.[0-9]{1,3})?" defaultValue={product?.salePrice ?? ""} placeholder="Facultatif" /></label>
            <label><span>Catégorie</span><select name="categoryId" defaultValue={product?.categoryId ?? ""}><option value="">Sans catégorie</option>{categories.filter((item) => item.isActive).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><span>Référence SKU</span><input name="sku" maxLength={100} defaultValue={product?.sku ?? ""} placeholder="Facultatif" /></label>
          </div>
          <div className={`product-stock-mode ${hasVariants ? "variant-mode" : "simple-mode"}`}>
            <div className="product-stock-mode-copy">
              <span className="stock-mode-icon" aria-hidden="true">{hasVariants ? "≡" : "#"}</span>
              <div>
                <strong>{hasVariants ? "Stock géré par variante" : "Stock global du produit"}</strong>
                <p>{hasVariants ? "Le total est calculé à partir des variantes actives. Modifiez chaque quantité dans la section Variantes." : "Ce produit n’a pas de variante : une seule quantité est suivie."}</p>
              </div>
            </div>
            {hasVariants ? (
              <div className="product-stock-total"><strong>{variantStock}</strong><span>unités disponibles</span></div>
            ) : (
              <label className="product-stock-input"><span>Quantité disponible *</span><input type="number" min={0} required value={simpleStock} onChange={(event) => setSimpleStock(Math.max(0, Number(event.target.value)))} /></label>
            )}
          </div>
        </section>
        <div className="product-editor-layout">
          <div className="product-editor-main">
            <section className="admin-panel" id="product-description">
              <div className="admin-section-title"><span>2</span><div><h2>Présentation du produit</h2><p>Les textes qui aideront les clients à comprendre votre offre.</p></div></div>
              <div className="form-grid">
                <label><span>Adresse de la page *</span><input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => { setSlug(event.target.value); setSlugTouched(true); }} placeholder="bouquet-harmonie" /><small>Générée automatiquement, sans espaces ni accents.</small></label>
              </div>
              <label><span>Résumé</span><textarea name="shortDescription" rows={3} maxLength={400} defaultValue={product?.shortDescription ?? ""} placeholder="Une phrase courte affichée sur les cartes produit." /><small>400 caractères maximum.</small></label>
              <label><span>Description complète</span><textarea name="description" rows={8} maxLength={20000} defaultValue={product?.description ?? ""} placeholder="Décrivez la composition, le style et les occasions adaptées." /></label>
            </section>

            <section className="admin-panel" id="product-photos">
              <div className="admin-section-title"><span>3</span><div><h2>Photos du produit</h2><p>Ajoutez vos images ici, sans passer par un autre écran.</p></div></div>
              <label className={`product-image-dropzone ${dragging ? "dragging" : ""} ${uploading ? "uploading" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={acceptDrop}>
                <span className="upload-icon" aria-hidden="true">＋</span>
                <strong>{uploading ? "Téléversement en cours…" : "Glissez vos images ici"}</strong>
                <span>ou cliquez pour parcourir · JPG, PNG, WebP ou AVIF · 5 Mo maximum</span>
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" onChange={selectFiles} disabled={uploading} />
              </label>
              {(uploading || uploadProgress > 0) && <div className="upload-progress"><progress value={uploadProgress} max={100} /><span>{uploadProgress} %</span></div>}
              {selectedAssets.length > 0 ? (
                <div className="selected-media-grid">
                  {selectedAssets.map((asset, index) => (
                    <article key={asset.id}>
                      <div className="selected-media-preview">
                        <Image src={asset.url} alt={asset.altText} fill sizes="(max-width: 700px) 50vw, 180px" />
                        {index === 0 && <span>Image principale</span>}
                      </div>
                      <label><span>Texte alternatif</span><input value={asset.altText} maxLength={260} onChange={(event) => updateMediaAlt(asset.id, event.target.value)} /></label>
                      <div className="media-card-actions">
                        <button type="button" disabled={index === 0} onClick={() => moveMedia(index, -1)} aria-label="Déplacer à gauche">←</button>
                        <button type="button" disabled={index === selectedAssets.length - 1} onClick={() => moveMedia(index, 1)} aria-label="Déplacer à droite">→</button>
                        <button className="danger-text" type="button" onClick={() => toggleMedia(asset.id)}>Retirer</button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : <div className="admin-empty compact"><strong>Aucune photo sélectionnée</strong><span>La première image ajoutée deviendra l’image principale.</span></div>}
              {media.length > selectedAssets.length && (
                <details className="media-library">
                  <summary>Choisir dans la médiathèque ({media.length})</summary>
                  <div className="media-picker">
                    {media.map((asset) => (
                      <button key={asset.id} className={selectedMedia.includes(asset.id) ? "selected" : ""} type="button" onClick={() => toggleMedia(asset.id)} aria-pressed={selectedMedia.includes(asset.id)}>
                        <Image src={asset.url} alt={asset.altText} width={240} height={240} sizes="(max-width: 560px) 45vw, 160px" />
                        <span>{asset.altText}</span>
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </section>

            <section className="admin-panel" id="product-variants">
              <div className="admin-panel-head">
                <div className="admin-section-title"><span>4</span><div><h2>Variantes et stock</h2><p>Chaque variante active possède sa propre quantité disponible.</p></div></div>
                <button className="button secondary compact-button" type="button" onClick={() => setVariants((current) => [...current, emptyVariant()])}>＋ Ajouter</button>
              </div>
              {variants.map((variant, index) => (
                <fieldset className="variant-card" key={variant.id ?? index}>
                  <legend>Variante {index + 1}</legend>
                  <div className="form-grid three-columns">
                    <label><span>Nom *</span><input required value={variant.name} onChange={(event) => updateVariant(index, { name: event.target.value })} placeholder="Ex. Taille classique" /></label>
                    <label><span>Référence SKU *</span><input required value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} placeholder="BOUQUET-CLASSIQUE" /></label>
                    <label><span>Stock *</span><input type="number" min={0} required value={variant.stock} onChange={(event) => updateVariant(index, { stock: Number(event.target.value) })} /></label>
                    <label><span>Prix spécifique</span><input inputMode="decimal" value={variant.price} onChange={(event) => updateVariant(index, { price: event.target.value })} placeholder="Laisser vide pour le prix principal" /></label>
                    <label><span>Prix promotionnel</span><input inputMode="decimal" value={variant.salePrice} onChange={(event) => updateVariant(index, { salePrice: event.target.value })} /></label>
                    <label className="checkbox switch-field"><input type="checkbox" checked={variant.isActive} onChange={(event) => updateVariant(index, { isActive: event.target.checked })} /><span>Variante disponible</span></label>
                  </div>
                  <div className="variant-options">
                    <div className="variant-options-head"><strong>Options</strong><button type="button" onClick={() => updateVariant(index, { options: [...variant.options, { name: "", value: "" }] })}>＋ Ajouter une option</button></div>
                    {variant.options.map((option, optionIndex) => (
                      <div className="variant-option-row" key={optionIndex}>
                        <label><span>Type</span><input value={option.name} onChange={(event) => updateVariantOption(index, optionIndex, { name: event.target.value })} placeholder="Taille" /></label>
                        <label><span>Valeur</span><input value={option.value} onChange={(event) => updateVariantOption(index, optionIndex, { value: event.target.value })} placeholder="Classique" /></label>
                        <button type="button" aria-label="Supprimer cette option" onClick={() => updateVariant(index, { options: variant.options.filter((_, position) => position !== optionIndex) })}>×</button>
                      </div>
                    ))}
                  </div>
                  <button className="button danger ghost" type="button" onClick={() => setVariants((current) => current.filter((_, position) => position !== index))}>Supprimer la variante</button>
                </fieldset>
              ))}
              {!variants.length && <div className="admin-empty compact"><strong>Produit sans variante</strong><span>Le prix et le stock principaux seront utilisés.</span></div>}
            </section>

            <section className="admin-panel" id="product-personalization">
              <div className="admin-panel-head">
                <div className="admin-section-title"><span>5</span><div><h2>Personnalisation</h2><p>Ajoutez les informations que le client peut saisir.</p></div></div>
                <button className="button secondary compact-button" type="button" onClick={() => setPersonalizations((current) => [...current, { key: "message", label: "Message sur la carte", required: false, maxLength: 120 }])}>＋ Ajouter un champ</button>
              </div>
              {personalizations.map((field, index) => (
                <div className="personalization-row" key={index}>
                  <label><span>Nom du champ</span><input value={field.label} onChange={(event) => updatePersonalization(index, { label: event.target.value, key: toSlug(event.target.value) })} placeholder="Message sur la carte" /></label>
                  <label><span>Limite de caractères</span><input type="number" min={1} max={300} value={field.maxLength} onChange={(event) => updatePersonalization(index, { maxLength: Number(event.target.value) })} /></label>
                  <label className="checkbox switch-field"><input type="checkbox" checked={field.required} onChange={(event) => updatePersonalization(index, { required: event.target.checked })} /><span>Obligatoire</span></label>
                  <button type="button" aria-label="Supprimer ce champ" onClick={() => setPersonalizations((current) => current.filter((_, position) => position !== index))}>×</button>
                </div>
              ))}
              {!personalizations.length && <div className="admin-empty compact"><strong>Aucune personnalisation</strong><span>Les clients ajouteront directement le produit au panier.</span></div>}
            </section>
          </div>

          <aside className="product-editor-sidebar">
            <section className="admin-panel">
              <h2>Classement secondaire</h2>
              <p className="admin-panel-intro">Ces informations facilitent la recherche et les regroupements, sans bloquer la publication.</p>
              <label><span>Mots-clés</span><input name="tags" defaultValue={product?.tags.join(", ") ?? ""} placeholder="mariage, rose, cadeau" /><small>Séparez les mots-clés par des virgules.</small></label>
              <fieldset className="collection-fieldset"><legend>Collections</legend><div className="check-grid">{collections.filter((item) => item.isActive).map((item) => <label className="checkbox" key={item.id}><input name="collectionIds" type="checkbox" value={item.id} defaultChecked={product?.collections.some((entry) => entry.collectionId === item.id)} /><span>{item.name}</span></label>)}</div>{!collections.length && <small>Créez d’abord une collection si nécessaire.</small>}</fieldset>
            </section>
            <section className="admin-panel">
              <h2>Référencement</h2>
              <label><span>Titre SEO</span><input name="metaTitle" maxLength={180} defaultValue={product?.metaTitle ?? ""} placeholder={name || "Nom affiché par les moteurs"} /></label>
              <label><span>Description SEO</span><textarea name="metaDescription" rows={4} maxLength={320} defaultValue={product?.metaDescription ?? ""} /></label>
            </section>
          </aside>
        </div>
      </form>
    </AdminDialog>
  );
}

function toVariantDraft(variant: AdminProductDetail["variants"][number]): VariantDraft {
  return {
    ...variant,
    price: variant.price ?? "",
    salePrice: variant.salePrice ?? "",
    options: Object.entries(variant.options).map(([name, value]) => ({ name, value })),
  };
}

function emptyVariant(): VariantDraft {
  return { name: "", sku: "", price: "", salePrice: "", stock: 0, isActive: true, options: [{ name: "Taille", value: "" }] };
}

function toPersonalizationDrafts(schema: Record<string, unknown> | null): PersonalizationDraft[] {
  if (!schema) return [];
  return Object.entries(schema).map(([key, raw]) => {
    const configuration = typeof raw === "object" && raw !== null ? raw as Record<string, unknown> : {};
    return {
      key,
      label: typeof configuration.label === "string" ? configuration.label : key,
      required: configuration.required === true,
      maxLength: typeof configuration.maxLength === "number" ? Math.min(300, configuration.maxLength) : 120,
    };
  });
}

function text(data: FormData, key: string): string {
  return String(data.get(key) ?? "").trim();
}

function nullable(data: FormData, key: string): string | null {
  return text(data, key) || null;
}
