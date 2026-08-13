"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { browserApi } from "@/services/api-client";
import type { TaxonomyAdmin } from "@/types/admin";
import { useNotifications } from "./admin-feedback";
import { messageOf, toSlug } from "./admin-form-utils";
import { AdminDialog, AdminPageHeader, ConfirmDialog, InlineError } from "./admin-ui";

type Kind = "categories" | "collections";
type EditorState = { mode: "create" } | { mode: "edit"; item: TaxonomyAdmin };

const COPY = {
  categories: {
    singular: "catégorie",
    plural: "Catégories",
    description: "Organisez les produits par famille pour simplifier la navigation dans la boutique.",
  },
  collections: {
    singular: "collection",
    plural: "Collections",
    description: "Regroupez les produits par saison, occasion ou univers commercial.",
  },
} as const;

export function TaxonomyManager({ kind }: { kind: Kind }) {
  const copy = COPY[kind];
  const { notify } = useNotifications();
  const [items, setItems] = useState<TaxonomyAdmin[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<TaxonomyAdmin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await browserApi<TaxonomyAdmin[]>(`/${kind}/admin`));
      setError(null);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }, [kind]);

  useEffect(() => {
    let active = true;
    void browserApi<TaxonomyAdmin[]>(`/${kind}/admin`)
      .then((value) => { if (active) { setItems(value); setError(null); } })
      .catch((caught) => { if (active) setError(messageOf(caught)); });
    return () => { active = false; };
  }, [kind]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setBusy(true);
    setFormError(null);
    const data = new FormData(event.currentTarget);
    const editing = editor.mode === "edit" ? editor.item : null;
    const body = {
      name: String(data.get("name") ?? "").trim(),
      slug: String(data.get("slug") ?? "").trim(),
      description: String(data.get("description") ?? "").trim(),
      isActive: data.get("isActive") === "on",
    };

    try {
      await browserApi(editing ? `/${kind}/admin/${editing.id}` : `/${kind}/admin`, {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setEditor(null);
      await load();
      notify({
        title: editing ? `${capitalize(copy.singular)} modifiée` : `${capitalize(copy.singular)} créée`,
        message: `${body.name} est maintenant disponible dans le catalogue.`,
      });
    } catch (caught) {
      setFormError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function changeActivity(item: TaxonomyAdmin, isActive: boolean) {
    setBusy(true);
    try {
      await browserApi(`/${kind}/admin/${item.id}`, {
        method: isActive ? "PATCH" : "DELETE",
        ...(isActive ? { body: JSON.stringify({ isActive: true }) } : {}),
      });
      setArchiveTarget(null);
      await load();
      notify({
        title: isActive ? `${capitalize(copy.singular)} réactivée` : `${capitalize(copy.singular)} désactivée`,
        message: item.name,
        tone: isActive ? "success" : "info",
      });
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  const editingItem = editor?.mode === "edit" ? editor.item : null;

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title={copy.plural}
        description={copy.description}
        action={<button className="button" type="button" onClick={() => { setFormError(null); setEditor({ mode: "create" }); }}>Ajouter une {copy.singular}</button>}
      />
      <InlineError message={error} />

      <section className="admin-panel">
        <div className="admin-panel-head">
          <div><h2>{copy.plural} existantes</h2><p className="admin-panel-description">{items.length} élément{items.length > 1 ? "s" : ""} enregistré{items.length > 1 ? "s" : ""}</p></div>
        </div>
        {items.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Nom</th><th>Produits</th><th>État</th><th>Actions</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.name}</strong><small className="table-subtitle">/{item.slug}</small></td>
                    <td>{item._count.products}</td>
                    <td><span className={`status ${item.isActive ? "success" : "muted"}`}>{item.isActive ? "Active" : "Inactive"}</span></td>
                    <td className="table-actions">
                      <button type="button" onClick={() => { setFormError(null); setEditor({ mode: "edit", item }); }}>Modifier</button>
                      {item.isActive
                        ? <button type="button" onClick={() => setArchiveTarget(item)}>Désactiver</button>
                        : <button type="button" onClick={() => void changeActivity(item, true)}>Réactiver</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="admin-empty">Aucune {copy.singular}. Utilisez le bouton d’ajout pour commencer.</p>}
      </section>

      <AdminDialog
        open={editor !== null}
        title={editingItem ? `Modifier la ${copy.singular}` : `Ajouter une ${copy.singular}`}
        description="Les informations seront utilisées immédiatement dans le catalogue."
        onClose={() => !busy && setEditor(null)}
      >
        {editor && <TaxonomyForm key={editingItem?.id ?? "create"} item={editingItem} busy={busy} error={formError} onSubmit={save} />}
      </AdminDialog>

      <ConfirmDialog
        open={archiveTarget !== null}
        title={`Désactiver la ${copy.singular} ?`}
        message={archiveTarget ? `« ${archiveTarget.name} » ne sera plus proposée pour les nouveaux produits. Les produits existants sont conservés.` : ""}
        confirmLabel="Désactiver"
        destructive
        busy={busy}
        onClose={() => !busy && setArchiveTarget(null)}
        onConfirm={() => archiveTarget && void changeActivity(archiveTarget, false)}
      />
    </>
  );
}

function TaxonomyForm({
  item,
  busy,
  error,
  onSubmit,
}: {
  item: TaxonomyAdmin | null;
  busy: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [slug, setSlug] = useState(item?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(item));

  return (
    <form className="admin-form dialog-form" onSubmit={onSubmit}>
      <InlineError message={error} />
      <label><span>Nom *</span><input name="name" required maxLength={120} value={name} autoFocus onChange={(event) => { setName(event.target.value); if (!slugEdited) setSlug(toSlug(event.target.value)); }} /></label>
      <label><span>Adresse URL *</span><input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={160} value={slug} onChange={(event) => { setSlug(event.target.value); setSlugEdited(true); }} /><small>Générée automatiquement. Utilisez uniquement des lettres minuscules, chiffres et tirets.</small></label>
      <label><span>Description</span><textarea name="description" maxLength={2000} rows={5} defaultValue={item?.description ?? ""} /></label>
      <label className="checkbox switch-field"><input name="isActive" type="checkbox" defaultChecked={item?.isActive ?? true} /><span>Disponible dans la boutique</span></label>
      <div className="admin-dialog-actions">
        <button className="button" disabled={busy}>{busy ? "Enregistrement…" : item ? "Enregistrer les modifications" : "Créer"}</button>
      </div>
    </form>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
