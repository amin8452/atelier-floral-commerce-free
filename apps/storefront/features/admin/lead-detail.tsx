"use client";

import { buildAdminWhatsAppUrl } from "@atelier/shared";
import { useEffect, useState, type FormEvent } from "react";
import { browserApi } from "@/services/api-client";
import type { AdminLead, AdminUser } from "@/types/admin";
import { messageOf } from "./admin-form-utils";
import { adminLabel } from "./admin-labels";

type LeadDetailData = AdminLead & {
  quantity: number; message: string | null; subject: string | null; consentAt: string; consentPolicyVersion: string;
  activities: Array<{ id: string; type: string; metadata: { note?: string; from?: string; to?: string } | null; createdAt: string; createdBy: { firstName: string | null; lastName: string | null } | null }>;
};

export function LeadDetail({ id }: { id: string }) {
  const [lead, setLead] = useState<LeadDetailData | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function load() { try { const [item, users] = await Promise.all([browserApi<LeadDetailData>(`/leads/admin/${id}`), browserApi<AdminUser[]>("/auth/admins")]); setLead(item); setAdmins(users); } catch (caught) { setError(messageOf(caught)); } }
  useEffect(() => {
    let active = true;
    void Promise.all([browserApi<LeadDetailData>(`/leads/admin/${id}`), browserApi<AdminUser[]>("/auth/admins")])
      .then(([item, users]) => { if (active) { setLead(item); setAdmins(users); } })
      .catch((caught) => { if (active) setError(messageOf(caught)); });
    return () => { active = false; };
  }, [id]);
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); const data = new FormData(event.currentTarget);
    const status = String(data.get("status") ?? ""); const note = String(data.get("note") ?? "").trim(); const assignedToId = String(data.get("assignedToId") ?? "");
    try { await browserApi(`/leads/admin/${id}`, { method: "PATCH", body: JSON.stringify({ status, ...(note ? { note } : {}), ...(assignedToId ? { assignedToId } : {}) }) }); await load(); }
    catch (caught) { setError(messageOf(caught)); } finally { setBusy(false); }
  }
  async function whatsapp() {
    if (!lead) return;
    await browserApi(`/leads/admin/${id}/whatsapp-opened`, { method: "POST" });
    window.open(buildAdminWhatsAppUrl(lead.phone, lead.firstName, lead.product?.name ?? null), "_blank", "noopener,noreferrer");
  }
  if (error && !lead) return <p className="admin-panel error-state">{error}</p>;
  if (!lead) return <p className="admin-panel">Chargement…</p>;
  return <>
    <div className="admin-page-head"><div><p className="eyebrow">Lead</p><h1>{lead.firstName} {lead.lastName}</h1></div><button className="button" onClick={() => void whatsapp()}>Ouvrir WhatsApp</button></div>
    {error && <p className="form-message error">{error}</p>}
    <div className="admin-two-columns">
      <section className="admin-panel detail-list"><h2>Coordonnées</h2><p><strong>Téléphone</strong><a href={`tel:${lead.phone}`}>{lead.phone}</a></p><p><strong>Email</strong>{lead.email ? <a href={`mailto:${lead.email}`}>{lead.email}</a> : "Non renseigné"}</p><p><strong>Préférence</strong>{adminLabel(lead.preferredContactMethod)}</p><p><strong>Source</strong>{adminLabel(lead.source)}</p><p><strong>Consentement</strong>{new Date(lead.consentAt).toLocaleString("fr")} · {lead.consentPolicyVersion}</p>{lead.product && <p><strong>Produit</strong>{lead.product.name}{lead.productVariant ? ` — ${lead.productVariant.name}` : ""} · Qté {lead.quantity}</p>}{lead.subject && <p><strong>Objet</strong>{lead.subject}</p>}{lead.message && <p><strong>Message</strong>{lead.message}</p>}</section>
      <section className="admin-panel"><h2>Suivi</h2><p className="admin-panel-description">Mettez à jour l’avancement et assignez la demande à un membre de l’équipe.</p><form className="admin-form" onSubmit={update}><label><span>État de la demande</span><select name="status" defaultValue={lead.status}>{["NEW", "CONTACTED", "INTERESTED", "CONVERTED", "LOST"].map((value) => <option key={value} value={value}>{adminLabel(value)}</option>)}</select></label><label><span>Responsable</span><select name="assignedToId" defaultValue={lead.assignedTo?.id ?? ""}><option value="">Non assigné</option>{admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.firstName ? `${admin.firstName} ${admin.lastName ?? ""}` : admin.email}</option>)}</select></label><label><span>Ajouter une note interne</span><textarea name="note" maxLength={2000} rows={4} placeholder="Ex. Client rappelé, souhaite une livraison vendredi." /></label><button className="button" disabled={busy}>Enregistrer le suivi</button></form></section>
    </div>
    <section className="admin-panel"><h2>Historique</h2><ol className="timeline">{lead.activities.map((activity) => <li key={activity.id}><strong>{activity.type}</strong><span>{new Date(activity.createdAt).toLocaleString("fr")}</span>{activity.metadata?.note && <p>{activity.metadata.note}</p>}</li>)}</ol></section>
  </>;
}
