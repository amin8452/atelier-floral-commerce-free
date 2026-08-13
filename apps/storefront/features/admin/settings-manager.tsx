"use client";

import Image from "next/image";
import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { browserApi } from "@/services/api-client";
import { uploadMediaAsset } from "@/services/media-upload";
import type { StoreSettings } from "@/types/api";
import { useNotifications } from "./admin-feedback";
import { formText, messageOf, optionalFormText } from "./admin-form-utils";
import { AdminDialog, AdminPageHeader, InlineError } from "./admin-ui";

type AdminSettings = StoreSettings & { taxRate: string };
type SettingsSection = "identity" | "address" | "commerce" | "appearance" | "social";

const SECTION_COPY: Record<SettingsSection, { title: string; description: string }> = {
  identity: { title: "Identité et contact", description: "Nom public, emails, WhatsApp et format régional." },
  address: { title: "Adresse de l’atelier", description: "Coordonnées physiques communiquées aux clients." },
  commerce: { title: "Livraison et paiement", description: "Frais, taxes et moyens de paiement disponibles." },
  appearance: { title: "Apparence de la boutique", description: "Images principales utilisées sur la page d’accueil." },
  social: { title: "Réseaux sociaux", description: "Liens vers les comptes publics de la boutique." },
};

export function SettingsManager() {
  const { notify } = useNotifications();
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [editing, setEditing] = useState<SettingsSection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [storyImageUrl, setStoryImageUrl] = useState("");
  const [uploadingImage, setUploadingImage] = useState<"hero" | "story" | null>(null);

  useEffect(() => {
    browserApi<AdminSettings>("/settings/admin")
      .then((value) => { setSettings(value); setHeroImageUrl(value.heroImageUrl ?? ""); setStoryImageUrl(value.storyImageUrl ?? ""); })
      .catch((caught) => setError(messageOf(caught)));
  }, []);

  function openEditor(section: SettingsSection) {
    if (!settings) return;
    setHeroImageUrl(settings.heroImageUrl ?? "");
    setStoryImageUrl(settings.storyImageUrl ?? "");
    setFormError(null);
    setEditing(section);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setFormError(null);
    const data = new FormData(event.currentTarget);
    const body = settingsBody(editing, data);
    try {
      const saved = await browserApi<AdminSettings>("/settings/admin", { method: "PATCH", body: JSON.stringify(body) });
      setSettings(saved);
      setHeroImageUrl(saved.heroImageUrl ?? "");
      setStoryImageUrl(saved.storyImageUrl ?? "");
      const title = SECTION_COPY[editing].title;
      setEditing(null);
      notify({ title: "Paramètres enregistrés", message: `La section « ${title} » a été mise à jour.` });
    } catch (caught) {
      setFormError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }

  async function uploadStoreImage(target: "hero" | "story", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadingImage(target);
    setFormError(null);
    try {
      const asset = await uploadMediaAsset(file, target === "hero" ? "Image de couverture de la boutique" : "Photo de présentation de l’atelier");
      if (target === "hero") setHeroImageUrl(asset.url);
      else setStoryImageUrl(asset.url);
    } catch (caught) {
      setFormError(messageOf(caught));
    } finally {
      setUploadingImage(null);
    }
  }

  if (!settings && !error) return <p className="admin-panel admin-loading-panel">Chargement des paramètres…</p>;

  return (
    <>
      <AdminPageHeader eyebrow="Configuration" title="Paramètres" description="Consultez la configuration actuelle puis modifiez uniquement la section nécessaire." />
      <InlineError message={error} />

      {settings && (
        <div className="settings-overview-grid">
          <SettingsCard section="identity" onEdit={openEditor}>
            <SettingsRow label="Boutique" value={settings.storeName} />
            <SettingsRow label="Email principal" value={settings.storeEmail || "Non renseigné"} />
            <SettingsRow label="Service client" value={settings.supportEmail || "Non renseigné"} />
            <SettingsRow label="WhatsApp" value={settings.whatsappNumber || "Non renseigné"} />
            <SettingsRow label="Devise et langue" value={`${settings.defaultCurrency} · ${settings.defaultLocale}`} />
          </SettingsCard>

          <SettingsCard section="address" onEdit={openEditor}>
            <SettingsRow label="Adresse" value={settings.address || "Non renseignée"} />
            <SettingsRow label="Ville" value={settings.city || "Non renseignée"} />
            <SettingsRow label="Pays" value={settings.country || "Non renseigné"} />
          </SettingsCard>

          <SettingsCard section="commerce" onEdit={openEditor}>
            <SettingsRow label="Livraison" value={settings.shippingEnabled ? "Activée" : "Désactivée"} tone={settings.shippingEnabled ? "success" : "muted"} />
            <SettingsRow label="Frais fixes" value={`${settings.shippingFlatRate} ${settings.defaultCurrency}`} />
            <SettingsRow label="Taxe" value={`${Number(settings.taxRate) * 100} %`} />
            <SettingsRow label="Paiement à la livraison" value={settings.codEnabled ? "Activé" : "Désactivé"} tone={settings.codEnabled ? "success" : "muted"} />
            <SettingsRow label="Paiement en ligne" value={settings.onlinePaymentEnabled ? "Activé" : "Non configuré"} tone={settings.onlinePaymentEnabled ? "success" : "muted"} />
          </SettingsCard>

          <SettingsCard section="appearance" onEdit={openEditor}>
            <div className="settings-overview-images">
              <SettingsImagePreview label="Couverture" value={settings.heroImageUrl} />
              <SettingsImagePreview label="Atelier" value={settings.storyImageUrl} />
            </div>
          </SettingsCard>

          <SettingsCard section="social" onEdit={openEditor}>
            <SettingsRow label="Instagram" value={settings.instagramUrl || "Non renseigné"} />
            <SettingsRow label="Facebook" value={settings.facebookUrl || "Non renseigné"} />
          </SettingsCard>
        </div>
      )}

      {settings && editing && (
        <AdminDialog open title={`Modifier · ${SECTION_COPY[editing].title}`} description={SECTION_COPY[editing].description} size={editing === "appearance" ? "large" : "medium"} onClose={() => !busy && setEditing(null)}>
          <form className="admin-form dialog-form" onSubmit={save} key={editing}>
            <InlineError message={formError} />
            <SettingsFields
              section={editing}
              settings={settings}
              heroImageUrl={heroImageUrl}
              storyImageUrl={storyImageUrl}
              uploadingImage={uploadingImage}
              onHeroChange={setHeroImageUrl}
              onStoryChange={setStoryImageUrl}
              onUpload={uploadStoreImage}
            />
            <div className="admin-dialog-actions">
              <button className="button secondary" type="button" onClick={() => setEditing(null)} disabled={busy}>Annuler</button>
              <button className="button" disabled={busy || uploadingImage !== null}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          </form>
        </AdminDialog>
      )}
    </>
  );
}

function SettingsCard({ section, onEdit, children }: { section: SettingsSection; onEdit: (section: SettingsSection) => void; children: ReactNode }) {
  const copy = SECTION_COPY[section];
  return (
    <section className={`admin-panel settings-overview-card settings-${section}`}>
      <div className="settings-card-head"><div><h2>{copy.title}</h2><p>{copy.description}</p></div><button className="button secondary compact-button" type="button" onClick={() => onEdit(section)}>Modifier</button></div>
      <div className="settings-card-content">{children}</div>
    </section>
  );
}

function SettingsRow({ label, value, tone }: { label: string; value: string; tone?: "success" | "muted" }) {
  return <div className="settings-row"><span>{label}</span>{tone ? <strong className={`status ${tone}`}>{value}</strong> : <strong>{value}</strong>}</div>;
}

function SettingsImagePreview({ label, value }: { label: string; value: string | null }) {
  return <div><span>{label}</span><div className="settings-overview-image">{value ? <Image src={value} alt={label} fill sizes="260px" /> : <strong>Aucune image</strong>}</div></div>;
}

function SettingsFields({ section, settings, heroImageUrl, storyImageUrl, uploadingImage, onHeroChange, onStoryChange, onUpload }: {
  section: SettingsSection;
  settings: AdminSettings;
  heroImageUrl: string;
  storyImageUrl: string;
  uploadingImage: "hero" | "story" | null;
  onHeroChange: (value: string) => void;
  onStoryChange: (value: string) => void;
  onUpload: (target: "hero" | "story", event: ChangeEvent<HTMLInputElement>) => void;
}) {
  if (section === "identity") return <><label><span>Nom de la boutique *</span><input name="storeName" required defaultValue={settings.storeName} autoFocus /></label><div className="form-grid"><label><span>Email principal</span><input name="storeEmail" type="email" defaultValue={settings.storeEmail ?? ""} /></label><label><span>Email du service client</span><input name="supportEmail" type="email" defaultValue={settings.supportEmail ?? ""} /></label><label><span>Numéro WhatsApp</span><input name="whatsappNumber" defaultValue={settings.whatsappNumber ?? ""} placeholder="Ex. +216 12 345 678" /></label><label><span>Devise *</span><input name="defaultCurrency" required minLength={3} maxLength={3} defaultValue={settings.defaultCurrency} /></label><label><span>Format régional *</span><input name="defaultLocale" required defaultValue={settings.defaultLocale} /><small>Ex. fr-TN</small></label></div></>;
  if (section === "address") return <><label><span>Adresse</span><input name="address" defaultValue={settings.address ?? ""} autoFocus /></label><div className="form-grid"><label><span>Ville</span><input name="city" defaultValue={settings.city ?? ""} /></label><label><span>Code pays</span><input name="country" minLength={2} maxLength={2} defaultValue={settings.country ?? ""} placeholder="TN" /></label></div></>;
  if (section === "commerce") return <><div className="form-grid"><label><span>Frais fixes de livraison</span><input name="shippingFlatRate" type="number" min={0} step="0.001" defaultValue={settings.shippingFlatRate} autoFocus /></label><label><span>Taxe en pourcentage</span><input name="taxRatePercent" type="number" min={0} max={100} step="0.01" defaultValue={Number(settings.taxRate) * 100} /></label></div><div className="check-grid"><label className="checkbox switch-field"><input name="shippingEnabled" type="checkbox" defaultChecked={settings.shippingEnabled} /><span>Livraison active</span></label><label className="checkbox switch-field"><input name="codEnabled" type="checkbox" defaultChecked={settings.codEnabled} /><span>Paiement à la livraison</span></label><label className="checkbox switch-field disabled"><input type="checkbox" checked={settings.onlinePaymentEnabled} disabled readOnly /><span>Paiement en ligne — fournisseur requis</span></label></div></>;
  if (section === "appearance") return <div className="settings-images-grid"><SettingsImageField label="Image de couverture" value={heroImageUrl} inputName="heroImageUrl" busy={uploadingImage === "hero"} onChange={onHeroChange} onUpload={(event) => onUpload("hero", event)} /><SettingsImageField label="Photo de l’atelier" value={storyImageUrl} inputName="storyImageUrl" busy={uploadingImage === "story"} onChange={onStoryChange} onUpload={(event) => onUpload("story", event)} /></div>;
  return <><label><span>Instagram</span><input name="instagramUrl" type="url" defaultValue={settings.instagramUrl ?? ""} placeholder="https://instagram.com/..." autoFocus /></label><label><span>Facebook</span><input name="facebookUrl" type="url" defaultValue={settings.facebookUrl ?? ""} placeholder="https://facebook.com/..." /></label></>;
}

function settingsBody(section: SettingsSection, data: FormData) {
  if (section === "identity") return { storeName: formText(data, "storeName"), storeEmail: optionalFormText(data, "storeEmail"), supportEmail: optionalFormText(data, "supportEmail"), whatsappNumber: optionalFormText(data, "whatsappNumber"), defaultCurrency: formText(data, "defaultCurrency").toUpperCase(), defaultLocale: formText(data, "defaultLocale") };
  if (section === "address") return { address: optionalFormText(data, "address"), city: optionalFormText(data, "city"), country: optionalFormText(data, "country")?.toUpperCase() ?? null };
  if (section === "commerce") return { shippingEnabled: data.get("shippingEnabled") === "on", shippingFlatRate: Number(formText(data, "shippingFlatRate")), taxRate: Number(formText(data, "taxRatePercent")) / 100, codEnabled: data.get("codEnabled") === "on" };
  if (section === "appearance") return { heroImageUrl: optionalFormText(data, "heroImageUrl"), storyImageUrl: optionalFormText(data, "storyImageUrl") };
  return { instagramUrl: optionalFormText(data, "instagramUrl"), facebookUrl: optionalFormText(data, "facebookUrl") };
}

function SettingsImageField({ label, value, inputName, busy, onChange, onUpload }: { label: string; value: string; inputName: string; busy: boolean; onChange: (value: string) => void; onUpload: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div className="settings-image-field">
      <strong>{label}</strong>
      <div className="settings-image-preview">{value ? <Image src={value} alt={label} fill sizes="(max-width: 700px) 100vw, 340px" /> : <span>Aucune image</span>}</div>
      <input name={inputName} type="hidden" value={value} />
      <div><label className="button secondary compact-button">{busy ? "Téléversement…" : value ? "Remplacer" : "Choisir une image"}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={onUpload} disabled={busy} /></label>{value && <button className="button danger ghost compact-button" type="button" onClick={() => onChange("")}>Retirer</button>}</div>
    </div>
  );
}
