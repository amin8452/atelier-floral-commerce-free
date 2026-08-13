import type { Metadata } from "next";
import { ContactForm } from "@/features/contact/contact-form";
import { getPublicSettings } from "@/services/settings";

export const metadata: Metadata = { title: "Nous contacter", description: "Posez une question sur un bijou, une commande ou une demande personnalisée." };

export default async function ContactPage() {
  const settings = await getPublicSettings();
  return <section className="section narrow"><div className="page-title"><p className="eyebrow">Parlons de votre demande</p><h1>Nous contacter</h1><p>Vous pouvez nous poser une question sur un bijou, le stock ou une commande. Pour une demande personnalisée, indiquez simplement le type de bijou et les couleurs souhaitées.</p></div><ContactForm />{settings.storeEmail && <p className="direct-contact">Vous préférez écrire directement ? Notre adresse est <a href={`mailto:${settings.storeEmail}`}>{settings.storeEmail}</a>.</p>}</section>;
}
