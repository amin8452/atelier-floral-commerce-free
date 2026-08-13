"use client";

import {
  useCallback,
  useEffect,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import Image from "next/image";
import { browserApi } from "@/services/api-client";
import { imageName, uploadMediaAsset } from "@/services/media-upload";
import type { AdminMedia } from "@/types/admin";
import type { PaginationMeta } from "@/types/api";
import { messageOf } from "./admin-form-utils";

type MediaResponse = { items: AdminMedia[]; meta: PaginationMeta };
export function MediaManager() {
  const [items, setItems] = useState<AdminMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const load = useCallback(
    () =>
      browserApi<MediaResponse>("/media/admin?pageSize=100")
        .then((result) => setItems(result.items))
        .catch((caught) => setError(messageOf(caught))),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Sélectionnez une image.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await uploadMediaAsset(file, altText, setProgress);
      setFile(null);
      setAltText("");
      setProgress(0);
      await load();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(false);
    }
  }
  function acceptDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files[0];
    if (dropped) {
      setFile(dropped);
      if (!altText) setAltText(imageName(dropped.name));
    }
  }
  async function remove(item: AdminMedia) {
    if (!window.confirm(`Supprimer « ${item.altText} » ?`)) return;
    try {
      await browserApi(`/media/admin/${item.id}`, { method: "DELETE" });
      await load();
    } catch (caught) {
      setError(messageOf(caught));
    }
  }
  return (
    <>
      <div className="admin-page-head">
        <div>
          <p className="eyebrow">Catalogue</p>
          <h1>Médiathèque</h1>
        </div>
      </div>
      {error && <p className="form-message error">{error}</p>}
      <section className="admin-panel">
        <h2>Ajouter une image</h2>
        <form className="admin-form inline-form" onSubmit={upload}>
          <label
            className={`drop-zone ${dragging ? "dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={acceptDrop}
          >
            <span>
              {file ? file.name : "Déposez une image ou parcourez vos fichiers"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                if (selected && !altText) setAltText(imageName(selected.name));
              }}
            />
          </label>
          <label>
            Texte alternatif
            <input
              value={altText}
              onChange={(event) => setAltText(event.target.value)}
              required
              maxLength={260}
            />
          </label>
          <button className="button" disabled={busy}>
            {busy ? "Téléversement…" : "Téléverser"}
          </button>
          {busy && (
            <progress
              value={progress}
              max={100}
              aria-label="Progression du téléversement"
            >
              {progress}%
            </progress>
          )}
        </form>
      </section>
      <section className="admin-panel">
        <h2>Images</h2>
        {items.length ? (
          <div className="media-grid">
            {items.map((item) => (
              <article key={item.id}>
                <Image
                  src={item.url}
                  alt={item.altText}
                  width={320}
                  height={320}
                  sizes="(max-width: 560px) 50vw, 220px"
                />
                <div>
                  <strong>{item.altText}</strong>
                  <small>
                    {Math.ceil(item.size / 1024)} Ko ·{" "}
                    {item.usedByStore ? "utilisée dans la boutique" : `${item._count?.productImages ?? 0} produit(s)`}
                  </small>
                  {(item._count?.productImages ?? 0) === 0 && !item.usedByStore && (
                    <button onClick={() => void remove(item)}>Supprimer</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-empty">Aucune image.</p>
        )}
      </section>
    </>
  );
}
