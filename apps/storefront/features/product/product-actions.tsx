"use client";

import { buildProductWhatsAppUrl, formatMoney } from "@atelier/shared";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useCart } from "@/features/cart/cart-provider";
import { browserApi } from "@/services/api-client";
import type { ProductDetail, StoreSettings } from "@/types/api";

export function ProductActions({
  product,
  settings,
  productUrl,
}: {
  product: ProductDetail;
  settings: StoreSettings;
  productUrl: string;
}) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [personalization, setPersonalization] = useState<
    Record<string, string>
  >({});
  const [showLead, setShowLead] = useState(false);
  const [status, setStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const { addItem, loading } = useCart();
  const variant =
    product.variants.find((item) => item.id === variantId) ?? null;
  const price =
    variant?.salePrice ??
    variant?.price ??
    product.salePrice ??
    product.basePrice;
  const stock = variant?.stock ?? product.stock;
  const available = stock > 0;
  const formattedPrice = formatMoney(
    price,
    settings.defaultCurrency,
    settings.defaultLocale,
  );
  const personalizationFields = useMemo(
    () => Object.entries(product.personalizationSchema ?? {}),
    [product.personalizationSchema],
  );

  useEffect(() => {
    void browserApi("/analytics/events", {
      method: "POST",
      body: JSON.stringify({ type: "PRODUCT_VIEW", productId: product.id }),
    }).catch(() => undefined);
  }, [product.id]);

  const whatsappUrl = safeProductWhatsAppUrl(
    settings.whatsappNumber,
    product.name,
    variant?.sku ?? product.sku,
    variant?.name ?? null,
    formattedPrice,
    productUrl,
  );

  async function handleAddToCart() {
    setStatus(null);
    try {
      await addItem({
        productId: product.id,
        ...(variant ? { variantId: variant.id } : {}),
        quantity,
        ...(Object.keys(personalization).length ? { personalization } : {}),
      });
      setStatus({ type: "success", text: "Création ajoutée au panier." });
    } catch (error) {
      setStatus({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "L’ajout au panier a échoué.",
      });
    }
  }

  function recordWhatsAppClick() {
    void browserApi("/analytics/events", {
      method: "POST",
      body: JSON.stringify({ type: "WHATSAPP_CLICK", productId: product.id }),
    }).catch(() => undefined);
  }

  return (
    <div className="product-actions-panel">
      {product.variants.length > 0 && (
        <label className="field">
          <span>Variante</span>
          <select
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
          >
            {product.variants.map((item) => (
              <option key={item.id} value={item.id} disabled={item.stock < 1}>
                {item.name}
                {item.stock < 1 ? " — épuisée" : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      {personalizationFields.map(([key, configuration]) => {
        const fieldConfiguration = typeof configuration === "object" && configuration !== null ? configuration : {};
        const label =
          "label" in fieldConfiguration && typeof fieldConfiguration.label === "string"
            ? fieldConfiguration.label
            : key;
        const required = "required" in fieldConfiguration && fieldConfiguration.required === true;
        const maxLength = "maxLength" in fieldConfiguration && typeof fieldConfiguration.maxLength === "number" ? Math.min(fieldConfiguration.maxLength, 300) : 300;
        return (
          <label className="field" key={key}>
            <span>{label}</span>
            <input
              maxLength={maxLength}
              required={required}
              value={personalization[key] ?? ""}
              onChange={(event) =>
                setPersonalization((current) => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
            />
          </label>
        );
      })}
      {available && <label className="field quantity-field">
        <span>Quantité</span>
        <input type="number" min={1} max={Math.min(stock, 100)} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} />
      </label>}
      <div className="product-cta-row">
        <button
          className="btn primary"
          type="button"
          disabled={!available || loading}
          onClick={() => void handleAddToCart()}
        >
          {loading
            ? "Ajout…"
            : available
              ? "Ajouter au panier"
              : "Indisponible"}
        </button>
        <button
          className="btn secondary"
          type="button"
          onClick={() => setShowLead((value) => !value)}
          aria-expanded={showLead}
        >
          Poser une question
        </button>
      </div>
      {whatsappUrl && (
        <a
          className="whatsapp-link"
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          onClick={recordWhatsAppClick}
        >
          Demander sur WhatsApp
        </a>
      )}
      {status && (
        <p
          className={status.type === "success" ? "form-success" : "form-error"}
          role="status"
        >
          {status.text}
        </p>
      )}
      {showLead && (
        <LeadForm
          product={product}
          {...(variant ? { variantId: variant.id } : {})}
          quantity={quantity}
        />
      )}
      {available && <div className="mobile-product-bar">
        <span>{formattedPrice}</span>
        <button
          className="btn primary"
          type="button"
          disabled={!available || loading}
          onClick={() => void handleAddToCart()}
        >
          Ajouter
        </button>
      </div>}
    </div>
  );
}

function safeProductWhatsAppUrl(
  number: string | null,
  productName: string,
  sku: string | null,
  variant: string | null,
  price: string,
  productUrl: string,
): string | null {
  if (!number) return null;
  try {
    return buildProductWhatsAppUrl({
      number,
      productName,
      sku,
      variant,
      price,
      productUrl,
    });
  } catch {
    return null;
  }
}

function LeadForm({
  product,
  variantId,
  quantity,
}: {
  product: ProductDetail;
  variantId?: string;
  quantity: number;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const data = new FormData(event.currentTarget);
    try {
      await browserApi("/leads", {
        method: "POST",
        body: JSON.stringify({
          firstName: data.get("firstName"),
          lastName: data.get("lastName"),
          phone: data.get("phone"),
          email: data.get("email") || undefined,
          productId: product.id,
          ...(variantId ? { productVariantId: variantId } : {}),
          quantity,
          message: data.get("message") || undefined,
          preferredContactMethod: data.get("preferredContactMethod"),
          consentToContact: data.get("consentToContact") === "on",
        }),
      });
      event.currentTarget.reset();
      setMessage({
        type: "success",
        text: "Votre demande a bien été enregistrée. L'atelier pourra vous recontacter.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "La demande n'a pas pu être envoyée.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="lead-form" onSubmit={submit}>
      <h2>Votre demande</h2>
      <div className="form-grid">
        <label className="field">
          <span>Prénom</span>
          <input name="firstName" required maxLength={80} />
        </label>
        <label className="field">
          <span>Nom</span>
          <input name="lastName" required maxLength={80} />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>Téléphone</span>
          <input name="phone" type="tel" required maxLength={40} />
        </label>
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" maxLength={254} />
        </label>
      </div>
      <label className="field">
        <span>Contact préféré</span>
        <select name="preferredContactMethod" defaultValue="WHATSAPP">
          <option value="WHATSAPP">WhatsApp</option>
          <option value="PHONE">Téléphone</option>
          <option value="EMAIL">Email</option>
        </select>
      </label>
      <label className="field">
        <span>Message</span>
        <textarea name="message" maxLength={2000} rows={4} />
      </label>
      <label className="consent-field">
        <input name="consentToContact" type="checkbox" required />
        <span>J’accepte d’être recontacté(e) au sujet de cette demande.</span>
      </label>
      <button className="btn primary" type="submit" disabled={submitting}>
        {submitting ? "Envoi…" : "Envoyer ma demande"}
      </button>
      {message && (
        <p
          className={message.type === "success" ? "form-success" : "form-error"}
          role="status"
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
