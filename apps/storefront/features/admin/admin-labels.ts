const labels: Record<string, string> = {
  DRAFT: "Brouillon",
  ACTIVE: "Publié",
  ARCHIVED: "Archivé",
  NEW: "À préparer",
  PROCESSING: "En préparation",
  READY: "Prêt",
  SHIPPED: "Expédié",
  DELIVERED: "Terminée",
  CANCELLED: "Annulé",
  PENDING: "À encaisser",
  PAID: "Payé",
  FAILED: "Échec",
  REFUNDED: "Remboursé",
  CONTACTED: "Contacté",
  INTERESTED: "Intéressé",
  CONVERTED: "Converti",
  LOST: "Perdu",
  WHATSAPP: "WhatsApp",
  PHONE: "Téléphone",
  EMAIL: "Email",
  PRODUCT_FORM: "Formulaire produit",
  CONTACT_FORM: "Formulaire de contact",
  ADMIN_CREATED: "Créé par l’administration",
  SUPER_ADMIN: "Super administrateur",
  ADMIN: "Administrateur",
  ORDER_MANAGER: "Gestion des commandes",
  PRODUCT_MANAGER: "Gestion du catalogue",
  SUPPORT: "Relation client",
  NOTE: "Note interne",
  CASH_ON_DELIVERY: "Paiement à la livraison",
  ONLINE: "Paiement en ligne",
};

export const PRODUCT_STATUS_VALUES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;

export function adminLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return labels[value] ?? value.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function statusTone(value: string): string {
  if (["ACTIVE", "PAID", "DELIVERED", "CONVERTED", "READY"].includes(value)) return "success";
  if (["ARCHIVED", "CANCELLED", "LOST", "FAILED", "REFUNDED"].includes(value)) return "muted";
  return "pending";
}
