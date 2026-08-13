"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { browserApi } from "@/services/api-client";
import type { AdminPromotion } from "@/types/admin";
import type { PaginationMeta } from "@/types/api";
import { useNotifications } from "./admin-feedback";
import { messageOf } from "./admin-form-utils";
import { AdminDialog, AdminPageHeader, InlineError } from "./admin-ui";

type PromotionResponse = { items: AdminPromotion[]; meta: PaginationMeta };
type EditorState = { mode: "create" } | { mode: "edit"; item: AdminPromotion };

export function PromotionsManager() {
  const { notify } = useNotifications();
  const [items, setItems] = useState<AdminPromotion[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await browserApi<PromotionResponse>("/promotions/admin?pageSize=100");
      setItems(result.items);
      setError(null);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }, []);

  useEffect(() => {
    let active = true;
    void browserApi<PromotionResponse>("/promotions/admin?pageSize=100")
      .then((result) => { if (active) { setItems(result.items); setError(null); } })
      .catch((caught) => { if (active) setError(messageOf(caught)); });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setBusy(true);
    setFormError(null);
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    const optional = (key: string) => value(key) || undefined;
    const editing = editor.mode === "edit" ? editor.item : null;
    const body = {
      name: value("name"),
      code: value("code").toUpperCase(),
      discountType: value("discountType"),
      discountValue: value("discountValue"),
      minimumAmount: optional("minimumAmount"),
      usageLimit: optional("usageLimit") ? Number(optional("usageLimit")) : undefined,
      startsAt: optional("startsAt") ? new Date(value("startsAt")).toISOString() : undefined,
      endsAt: optional("endsAt") ? new Date(value("endsAt")).toISOString() : undefined,
      isActive: data.get("isActive") === "on",
    };

    try {
      await browserApi(editing ? `/promotions/admin/${editing.id}` : "/promotions/admin", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setEditor(null);
      await load();
      notify({
        title: editing ? "Promotion modifiée" : "Promotion créée",
        message: `Le code ${body.code} a été enregistré.`,
      });
    } catch (caught) {
      setFormError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  const editingItem = editor?.mode === "edit" ? editor.item : null;

  return (
    <>
      <AdminPageHeader
        eyebrow="Ventes"
        title="Promotions"
        description="Créez et planifiez les codes promotionnels proposés à vos clients."
        action={<button className="button" type="button" onClick={() => { setFormError(null); setEditor({ mode: "create" }); }}>Ajouter une promotion</button>}
      />
      <InlineError message={error} />

      <section className="admin-panel">
        <div className="admin-panel-head"><div><h2>Codes existants</h2><p className="admin-panel-description">Suivez leur période, leur utilisation et leur disponibilité.</p></div></div>
        {items.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>Promotion</th><th>Remise</th><th>Utilisation</th><th>Période</th><th>État</th><th>Actions</th></tr></thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.code}</strong><small className="table-subtitle">{item.name}</small></td>
                    <td>{item.discountValue}{item.discountType === "PERCENTAGE" ? " %" : ""}</td>
                    <td>{item.usageCount} / {item.usageLimit ?? "Illimité"}</td>
                    <td><small>{periodLabel(item)}</small></td>
                    <td><span className={`status ${item.isActive ? "success" : "muted"}`}>{item.isActive ? "Active" : "Inactive"}</span></td>
                    <td className="table-actions"><button type="button" onClick={() => { setFormError(null); setEditor({ mode: "edit", item }); }}>Modifier</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="admin-empty">Aucune promotion. Créez votre premier code lorsque vous êtes prêt.</p>}
      </section>

      <AdminDialog
        open={editor !== null}
        title={editingItem ? "Modifier la promotion" : "Ajouter une promotion"}
        description="Définissez le code, la remise et les conditions d’utilisation."
        size="large"
        onClose={() => !busy && setEditor(null)}
      >
        {editor && <PromotionForm key={editingItem?.id ?? "create"} item={editingItem} busy={busy} error={formError} onSubmit={save} />}
      </AdminDialog>
    </>
  );
}

function PromotionForm({ item, busy, error, onSubmit }: { item: AdminPromotion | null; busy: boolean; error: string | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="admin-form dialog-form" onSubmit={onSubmit}>
      <InlineError message={error} />
      <div className="form-grid">
        <label><span>Nom *</span><input name="name" required maxLength={160} defaultValue={item?.name ?? ""} autoFocus placeholder="Ex. Offre de bienvenue" /></label>
        <label><span>Code *</span><input name="code" required pattern="[A-Za-z0-9_-]+" maxLength={80} defaultValue={item?.code ?? ""} placeholder="BIENVENUE10" /></label>
        <label><span>Type de remise *</span><select name="discountType" defaultValue={item?.discountType ?? "PERCENTAGE"}><option value="PERCENTAGE">Pourcentage</option><option value="FIXED">Montant fixe</option></select></label>
        <label><span>Valeur *</span><input name="discountValue" required inputMode="decimal" defaultValue={item?.discountValue ?? ""} placeholder="10" /></label>
        <label><span>Minimum de commande</span><input name="minimumAmount" inputMode="decimal" defaultValue={item?.minimumAmount ?? ""} placeholder="Aucun minimum" /></label>
        <label><span>Nombre maximal d’utilisations</span><input name="usageLimit" type="number" min={1} defaultValue={item?.usageLimit ?? ""} placeholder="Illimité" /></label>
        <label><span>Date de début</span><input name="startsAt" type="datetime-local" defaultValue={localDate(item?.startsAt)} /></label>
        <label><span>Date de fin</span><input name="endsAt" type="datetime-local" defaultValue={localDate(item?.endsAt)} /></label>
      </div>
      <label className="checkbox switch-field"><input name="isActive" type="checkbox" defaultChecked={item?.isActive ?? true} /><span>Promotion active</span></label>
      <div className="admin-dialog-actions"><button className="button" disabled={busy}>{busy ? "Enregistrement…" : item ? "Enregistrer les modifications" : "Créer la promotion"}</button></div>
    </form>
  );
}

function localDate(value: string | null | undefined): string {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

function periodLabel(item: AdminPromotion) {
  if (!item.startsAt && !item.endsAt) return "Sans limite";
  const format = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));
  if (item.startsAt && item.endsAt) return `${format(item.startsAt)} → ${format(item.endsAt)}`;
  return item.startsAt ? `Dès le ${format(item.startsAt)}` : `Jusqu’au ${format(item.endsAt!)}`;
}
