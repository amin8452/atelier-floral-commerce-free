"use client";

import { useState } from "react";
import { browserApi } from "@/services/api-client";
import { useNotifications } from "./admin-feedback";
import { messageOf } from "./admin-form-utils";
import { ConfirmDialog } from "./admin-ui";

type CompletableOrder = {
  id: string;
  orderNumber: string;
  paymentStatus: string;
  fulfillmentStatus: string;
};

export function CompleteOrderAction({ order, onCompleted, compact = false }: {
  order: CompletableOrder;
  onCompleted: () => void | Promise<void>;
  compact?: boolean;
}) {
  const { notify } = useNotifications();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const isFinished = order.fulfillmentStatus === "DELIVERED" && order.paymentStatus === "PAID";
  if (isFinished || order.fulfillmentStatus === "CANCELLED") return null;

  async function complete() {
    setBusy(true);
    try {
      await browserApi(`/orders/admin/${order.id}/complete`, { method: "POST" });
      setOpen(false);
      await onCompleted();
      notify({
        title: "Commande terminée",
        message: `${order.orderNumber} est terminée${order.paymentStatus === "PENDING" ? " et son paiement à la livraison est marqué comme encaissé" : ""}.`,
      });
    } catch (caught) {
      notify({ title: "Impossible de terminer la commande", message: messageOf(caught), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className={compact ? "table-quick-action" : "button"} type="button" onClick={() => setOpen(true)}>
        Terminer
      </button>
      <ConfirmDialog
        open={open}
        title="Terminer cette commande ?"
        message={order.paymentStatus === "PENDING"
          ? "La commande passera à « Terminée » et le paiement à la livraison sera comptabilisé comme encaissé."
          : "La commande passera à « Terminée ». Cette action restera visible dans son historique."}
        confirmLabel="Terminer la commande"
        busy={busy}
        onClose={() => !busy && setOpen(false)}
        onConfirm={() => void complete()}
      />
    </>
  );
}
