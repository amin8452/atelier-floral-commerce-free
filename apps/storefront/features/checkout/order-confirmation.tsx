"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

export function OrderConfirmation({ orderNumber }: { orderNumber: string | null }) {
  const confirmed = useSyncExternalStore(
    subscribe,
    () => Boolean(orderNumber && window.sessionStorage.getItem("atelier.order." + orderNumber)),
    () => false,
  );
  return <section className="section narrow"><div className="state-panel success-state">{orderNumber && confirmed ? <><p className="eyebrow">Commande enregistrée</p><h1>Merci pour votre commande.</h1><p>Votre référence est <strong>{orderNumber}</strong>. Conservez-la pour vos échanges avec l’atelier.</p></> : <><h1>Confirmation indisponible.</h1><p>Cette page ne permet pas de déduire l’état d’un paiement. Consultez uniquement la confirmation affichée immédiatement après votre commande.</p></>}<Link className="btn primary" href="/boutique">Retour à la boutique</Link></div></section>;
}
