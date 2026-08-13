"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { browserApi } from "@/services/api-client";
import { useNotifications } from "./admin-feedback";
import { messageOf } from "./admin-form-utils";
import { adminLabel } from "./admin-labels";
import { useAdmin } from "./admin-shell";
import { AdminDialog, AdminPageHeader, InlineError } from "./admin-ui";

const roles = ["SUPER_ADMIN", "ADMIN", "ORDER_MANAGER", "PRODUCT_MANAGER", "SUPPORT"] as const;

type AdminAccount = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
};
type EditorState = { mode: "create" } | { mode: "edit"; item: AdminAccount };

export function UsersManager() {
  const current = useAdmin();
  const { notify } = useNotifications();
  const [items, setItems] = useState<AdminAccount[]>([]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await browserApi<AdminAccount[]>("/auth/admin-users"));
      setError(null);
    } catch (caught) {
      setError(messageOf(caught));
    }
  }, []);

  useEffect(() => {
    let active = true;
    void browserApi<AdminAccount[]>("/auth/admin-users")
      .then((value) => { if (active) { setItems(value); setError(null); } })
      .catch((caught) => { if (active) setError(messageOf(caught)); });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setBusy(true);
    setFormError(null);
    const data = new FormData(event.currentTarget);
    const editing = editor.mode === "edit" ? editor.item : null;
    const isActive = editing ? data.get("isActive") === "on" : true;
    const body = {
      email: String(data.get("email") ?? "").trim(),
      firstName: String(data.get("firstName") ?? "").trim(),
      lastName: String(data.get("lastName") ?? "").trim(),
      role: String(data.get("role") ?? "ADMIN"),
      ...(editing
        ? { isActive }
        : { password: String(data.get("password") ?? "") }),
    };

    try {
      await browserApi(editing ? `/auth/admin-users/${editing.id}` : "/auth/admin-users", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setEditor(null);
      await load();
      notify({
        title: editing ? "Utilisateur modifié" : "Utilisateur créé",
        message: `${body.email} peut ${isActive ? "accéder" : "ne plus accéder"} à l’administration.`,
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
        eyebrow="Sécurité"
        title="Utilisateurs"
        description="Contrôlez les comptes qui peuvent accéder à l’administration et leurs responsabilités."
        action={<button className="button" type="button" onClick={() => { setFormError(null); setEditor({ mode: "create" }); }}>Ajouter un utilisateur</button>}
      />
      <InlineError message={error} />

      <section className="admin-panel">
        <div className="admin-panel-head"><div><h2>Comptes administrateurs</h2><p className="admin-panel-description">Les droits sont appliqués immédiatement après enregistrement.</p></div></div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Utilisateur</th><th>Rôle</th><th>État</th><th>Création</th><th>Actions</th></tr></thead>
            <tbody>
              {items.map((item) => {
                const isCurrent = item.id === current.id;
                return (
                  <tr key={item.id}>
                    <td><strong>{displayName(item)}</strong><small className="table-subtitle">{item.email}{isCurrent ? " · Vous" : ""}</small></td>
                    <td>{adminLabel(item.role)}</td>
                    <td><span className={`status ${item.isActive ? "success" : "muted"}`}>{item.isActive ? "Actif" : "Inactif"}</span></td>
                    <td>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(item.createdAt))}</td>
                    <td className="table-actions">{isCurrent ? <span className="table-muted-action">Mon profil</span> : <button type="button" onClick={() => { setFormError(null); setEditor({ mode: "edit", item }); }}>Modifier</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <AdminDialog
        open={editor !== null}
        title={editingItem ? "Modifier l’utilisateur" : "Ajouter un utilisateur"}
        description={editingItem ? "Mettez à jour les informations, le rôle ou l’accès de ce compte." : "Créez un accès nominatif avec uniquement les permissions nécessaires."}
        size="large"
        onClose={() => !busy && setEditor(null)}
      >
        {editor && <UserForm key={editingItem?.id ?? "create"} item={editingItem} busy={busy} error={formError} onSubmit={save} />}
      </AdminDialog>
    </>
  );
}

function UserForm({ item, busy, error, onSubmit }: { item: AdminAccount | null; busy: boolean; error: string | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="admin-form dialog-form" onSubmit={onSubmit}>
      <InlineError message={error} />
      <div className="form-grid">
        <label><span>Prénom</span><input name="firstName" maxLength={80} defaultValue={item?.firstName ?? ""} autoFocus /></label>
        <label><span>Nom</span><input name="lastName" maxLength={80} defaultValue={item?.lastName ?? ""} /></label>
      </div>
      <label><span>Adresse email *</span><input name="email" type="email" required maxLength={254} defaultValue={item?.email ?? ""} /></label>
      {!item && <label><span>Mot de passe initial *</span><input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /><small>Communiquez-le de façon sécurisée. L’utilisateur pourra ensuite le modifier depuis son profil.</small></label>}
      <label><span>Rôle *</span><select name="role" defaultValue={item?.role ?? "ADMIN"}>{roles.map((role) => <option key={role} value={role}>{adminLabel(role)}</option>)}</select><small>Attribuez uniquement les droits nécessaires à la mission de cette personne.</small></label>
      {item && <label className="checkbox switch-field"><input name="isActive" type="checkbox" defaultChecked={item.isActive} /><span>Compte autorisé à se connecter</span></label>}
      <div className="admin-dialog-actions"><button className="button" disabled={busy}>{busy ? "Enregistrement…" : item ? "Enregistrer les modifications" : "Créer le compte"}</button></div>
    </form>
  );
}

function displayName(account: Pick<AdminAccount, "firstName" | "lastName" | "email">) {
  return [account.firstName, account.lastName].filter(Boolean).join(" ") || account.email;
}
