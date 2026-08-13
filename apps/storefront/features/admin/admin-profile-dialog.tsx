"use client";

import { useState, type FormEvent } from "react";
import { browserApi } from "@/services/api-client";
import type { AdminUser } from "@/types/admin";
import { useNotifications } from "./admin-feedback";
import { messageOf } from "./admin-form-utils";
import { adminLabel } from "./admin-labels";
import { AdminDialog, InlineError } from "./admin-ui";

type ProfileTab = "profile" | "security";

export function AdminProfileDialog({
  open,
  admin,
  onClose,
  onUpdated,
}: {
  open: boolean;
  admin: AdminUser;
  onClose: () => void;
  onUpdated: (admin: AdminUser) => void;
}) {
  const { notify } = useNotifications();
  const [tab, setTab] = useState<ProfileTab>("profile");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const updated = await browserApi<AdminUser>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: String(data.get("firstName") ?? "").trim(),
          lastName: String(data.get("lastName") ?? "").trim(),
          email: String(data.get("email") ?? "").trim(),
        }),
      });
      onUpdated(updated);
      notify({ title: "Profil mis à jour", message: "Vos informations personnelles ont été enregistrées." });
      onClose();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    const newPassword = String(data.get("newPassword") ?? "");
    if (newPassword !== String(data.get("confirmPassword") ?? "")) {
      setError("La confirmation ne correspond pas au nouveau mot de passe.");
      setBusy(false);
      return;
    }
    try {
      await browserApi("/auth/profile/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword: data.get("currentPassword"), newPassword }),
      });
      form.reset();
      notify({ title: "Mot de passe modifié", message: "Les autres sessions de votre compte ont été fermées." });
      onClose();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  function selectTab(nextTab: ProfileTab) {
    setTab(nextTab);
    setError(null);
  }

  return (
    <AdminDialog open={open} title="Mon profil" description="Gérez vos informations personnelles et la sécurité de votre compte." size="medium" onClose={() => !busy && onClose()}>
      <div className="profile-tabs" role="tablist" aria-label="Sections du profil">
        <button type="button" role="tab" aria-selected={tab === "profile"} className={tab === "profile" ? "active" : ""} onClick={() => selectTab("profile")}>Informations</button>
        <button type="button" role="tab" aria-selected={tab === "security"} className={tab === "security" ? "active" : ""} onClick={() => selectTab("security")}>Sécurité</button>
      </div>
      <InlineError message={error} />

      {tab === "profile" ? (
        <form className="admin-form dialog-form" onSubmit={saveProfile}>
          <div className="form-grid">
            <label><span>Prénom</span><input name="firstName" maxLength={80} defaultValue={admin.firstName ?? ""} autoFocus /></label>
            <label><span>Nom</span><input name="lastName" maxLength={80} defaultValue={admin.lastName ?? ""} /></label>
          </div>
          <label><span>Adresse email *</span><input name="email" type="email" maxLength={254} required defaultValue={admin.email} /></label>
          <div className="profile-role-note"><span>Rôle</span><strong>{adminLabel(admin.role)}</strong><small>Seul un super-administrateur peut modifier les rôles.</small></div>
          <div className="admin-dialog-actions"><button className="button" disabled={busy}>{busy ? "Enregistrement…" : "Enregistrer mon profil"}</button></div>
        </form>
      ) : (
        <form className="admin-form dialog-form" onSubmit={changePassword}>
          <label><span>Mot de passe actuel *</span><input name="currentPassword" type="password" autoComplete="current-password" minLength={12} maxLength={128} required autoFocus /></label>
          <label><span>Nouveau mot de passe *</span><input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><small>Utilisez au moins 12 caractères et évitez un mot de passe déjà utilisé ailleurs.</small></label>
          <label><span>Confirmer le nouveau mot de passe *</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
          <div className="admin-dialog-actions"><button className="button" disabled={busy}>{busy ? "Modification…" : "Modifier le mot de passe"}</button></div>
        </form>
      )}
    </AdminDialog>
  );
}
