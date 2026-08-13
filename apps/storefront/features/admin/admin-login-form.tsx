"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError, browserApi } from "@/services/api-client";

function loginErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Connexion impossible. Vérifiez votre connexion puis réessayez.";
  if (error.status === 401) return "Adresse email ou mot de passe incorrect.";
  if (error.status === 429) return "Trop de tentatives. Patientez une minute avant de réessayer.";
  if (error.status >= 500) return "Le service est momentanément indisponible. Réessayez dans quelques instants.";
  return error.message;
}

export function AdminLoginForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    const data = new FormData(event.currentTarget);

    try {
      await browserApi("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });
      router.replace("/admin");
      router.refresh();
    } catch (caught) {
      setError(loginErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={submit}>
        <div className="admin-login-heading">
          <p className="eyebrow">Administration</p>
          <h1>Connexion</h1>
          <p>Accédez à la gestion de votre boutique Atelier Floral.</p>
        </div>

        <label className="field">
          <span>Adresse email</span>
          <input name="email" type="email" autoComplete="username" inputMode="email" spellCheck={false} autoFocus required />
        </label>
        <label className="field">
          <span>Mot de passe</span>
          <input name="password" type="password" autoComplete="current-password" required minLength={12} />
        </label>

        <button className="btn primary" type="submit" disabled={submitting}>
          {submitting ? "Connexion…" : "Se connecter"}
        </button>
        {error && (
          <p className="form-error" role="alert" aria-live="polite">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
