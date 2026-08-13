"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/features/cart/cart-provider";

export function ProductCardAction({ productId, productHref, available, canQuickOrder }: {
  productId: string;
  productHref: string;
  available: boolean;
  canQuickOrder: boolean;
}) {
  const router = useRouter();
  const { addItem, loading } = useCart();
  const [error, setError] = useState<string | null>(null);

  if (!available) return <span className="product-card-unavailable">Actuellement indisponible</span>;
  if (!canQuickOrder) return <Link className="button product-card-order secondary" href={productHref} aria-label="Choisir les options et commander">Commander</Link>;

  async function order() {
    setError(null);
    try {
      await addItem({ productId, quantity: 1 });
      router.push("/panier");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d’ajouter ce produit au panier.");
    }
  }

  return (
    <div className="product-card-order-wrap">
      <button className="button product-card-order" type="button" disabled={loading} onClick={() => void order()}>
        {loading ? "Ajout…" : "Commander"}
      </button>
      {error && <small className="product-card-order-error" role="alert">{error}</small>}
    </div>
  );
}
