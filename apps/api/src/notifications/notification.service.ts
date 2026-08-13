import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { type Transporter } from "nodemailer";
import { getAppConfig } from "../config/app.config.js";
import { getMailConfig, type MailConfig } from "../config/mail.config.js";

export type LeadNotification = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  message: string | null;
  preferredContactMethod: string;
  quantity: number;
  productName: string | null;
  sku: string | null;
  variantName: string | null;
};

export type ProductDeletionNotification = {
  id: string;
  name: string;
  scheduledFor: Date;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly mail: MailConfig;
  private readonly transporter: Transporter | null;

  constructor(private readonly config: ConfigService) {
    this.mail = getMailConfig(config);
    this.transporter = this.mail.mode === "smtp"
      ? nodemailer.createTransport({
          host: this.mail.host,
          port: this.mail.port,
          secure: this.mail.secure,
          auth: { user: this.mail.user, pass: this.mail.password },
        })
      : null;
  }

  async notifySellerOfLead(lead: LeadNotification): Promise<boolean> {
    if (this.mail.mode === "disabled" || !this.transporter) return false;
    const dashboardUrl = `${getAppConfig(this.config).appUrl.replace(/\/$/, "")}/admin/leads/${lead.id}`;
    const productName = lead.productName ?? "Demande générale";
    const lines = [
      "Nouveau prospect",
      "",
      `Produit : ${productName}`,
      `SKU : ${lead.sku ?? "—"}`,
      `Variante : ${lead.variantName ?? "—"}`,
      `Quantité : ${lead.quantity}`,
      `Client : ${lead.firstName} ${lead.lastName}`,
      `Téléphone : ${lead.phone}`,
      `Email : ${lead.email ?? "—"}`,
      `Contact préféré : ${lead.preferredContactMethod}`,
      `Message : ${lead.message ?? "—"}`,
      "",
      `Voir dans le dashboard : ${dashboardUrl}`,
    ];

    try {
      const safeProductName = productName.replace(/[\r\n]+/g, " ").slice(0, 180);
      await this.transporter.sendMail({
        from: this.mail.from,
        to: this.mail.sellerEmail,
        subject: `Nouveau client intéressé — ${safeProductName}`,
        text: lines.join("\n"),
        html: `<h1>Nouveau prospect</h1><dl>${this.htmlRow("Produit", productName)}${this.htmlRow("SKU", lead.sku)}${this.htmlRow("Variante", lead.variantName)}${this.htmlRow("Quantité", String(lead.quantity))}${this.htmlRow("Client", `${lead.firstName} ${lead.lastName}`)}${this.htmlRow("Téléphone", lead.phone)}${this.htmlRow("Email", lead.email)}${this.htmlRow("Contact préféré", lead.preferredContactMethod)}${this.htmlRow("Message", lead.message)}</dl><p><a href="${this.escapeHtml(dashboardUrl)}">Voir dans le dashboard</a></p>`,
      });
      if (lead.email) {
        await this.sendCustomerConfirmation(lead.email, lead.firstName, safeProductName);
      }
      return true;
    } catch (error) {
      this.logger.warn(`Lead ${lead.id}: notification email non envoyée (${error instanceof Error ? error.message : "erreur inconnue"})`);
      return false;
    }
  }

  async notifyAdminOfProductDeletion(product: ProductDeletionNotification): Promise<boolean> {
    if (this.mail.mode === "disabled" || !this.transporter) return false;
    const productsUrl = `${getAppConfig(this.config).appUrl.replace(/\/$/, "")}/admin/produits`;
    const safeName = product.name.replace(/[\r\n]+/g, " ").slice(0, 180);
    const scheduledFor = product.scheduledFor.toISOString();

    try {
      await this.transporter.sendMail({
        from: this.mail.from,
        to: this.mail.sellerEmail,
        subject: `Suppression programmée — ${safeName}`,
        text: `Le produit « ${safeName} » sera supprimé définitivement le ${scheduledFor}. Vous disposez de 24 heures pour annuler la suppression depuis ${productsUrl}.`,
        html: `<h1>Suppression de produit programmée</h1><p>Le produit <strong>${this.escapeHtml(safeName)}</strong> sera supprimé définitivement le ${this.escapeHtml(scheduledFor)}.</p><p>Vous disposez de 24 heures pour <a href="${this.escapeHtml(productsUrl)}">annuler la suppression</a>.</p>`,
      });
      return true;
    } catch (error) {
      this.logger.warn(`Produit ${product.id}: notification de suppression non envoyée (${error instanceof Error ? error.message : "erreur inconnue"})`);
      return false;
    }
  }

  private async sendCustomerConfirmation(email: string, firstName: string, productName: string): Promise<void> {
    if (this.mail.mode !== "smtp" || !this.transporter) return;
    try {
      await this.transporter.sendMail({
        from: this.mail.from,
        to: email,
        subject: "Nous avons bien reçu votre demande",
        text: `Bonjour ${firstName},\n\nVotre demande concernant ${productName} a bien été enregistrée. L’atelier vous recontactera selon le moyen choisi.\n\nMerci.`,
        html: `<p>Bonjour ${this.escapeHtml(firstName)},</p><p>Votre demande concernant <strong>${this.escapeHtml(productName)}</strong> a bien été enregistrée. L’atelier vous recontactera selon le moyen choisi.</p><p>Merci.</p>`,
      });
    } catch (error) {
      this.logger.warn(`Confirmation client non envoyée (${error instanceof Error ? error.message : "erreur inconnue"})`);
    }
  }

  private htmlRow(label: string, value: string | null): string {
    return `<dt><strong>${this.escapeHtml(label)}</strong></dt><dd>${this.escapeHtml(value ?? "—")}</dd>`;
  }

  private escapeHtml(value: string): string {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
}
