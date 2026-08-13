"use client";

import { useState, type FormEvent } from "react";
import { browserApi } from "@/services/api-client";

export function ContactForm() {
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; text: string } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await browserApi("/leads/contact", {
        method: "POST",
        body: JSON.stringify({
          firstName: data.get("firstName"), lastName: data.get("lastName"), phone: data.get("phone"),
          email: data.get("email") || undefined, subject: data.get("subject"), message: data.get("message"),
          preferredContactMethod: data.get("preferredContactMethod"), consentToContact: data.get("consentToContact") === "on",
        }),
      });
      form.reset();
      setFeedback({ success: true, text: "Votre message a bien été enregistré." });
    } catch (error) {
      setFeedback({ success: false, text: error instanceof Error ? error.message : "Le message n'a pas pu être envoyé." });
    } finally { setSubmitting(false); }
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="form-grid"><label className="field"><span>Prénom</span><input name="firstName" required maxLength={80} /></label><label className="field"><span>Nom</span><input name="lastName" required maxLength={80} /></label></div>
      <div className="form-grid"><label className="field"><span>Téléphone</span><input name="phone" type="tel" required maxLength={40} /></label><label className="field"><span>Email</span><input name="email" type="email" maxLength={254} /></label></div>
      <label className="field"><span>Sujet</span><input name="subject" required maxLength={180} /></label>
      <label className="field"><span>Contact préféré</span><select name="preferredContactMethod" defaultValue="EMAIL"><option value="EMAIL">Email</option><option value="WHATSAPP">WhatsApp</option><option value="PHONE">Téléphone</option></select></label>
      <label className="field"><span>Message</span><textarea name="message" required rows={6} maxLength={2000} /></label>
      <label className="consent-field"><input name="consentToContact" type="checkbox" required /><span>J’accepte d’être recontacté(e) au sujet de cette demande.</span></label>
      <button className="btn primary" type="submit" disabled={submitting}>{submitting ? "Envoi…" : "Envoyer"}</button>
      {feedback && <p className={feedback.success ? "form-success" : "form-error"} role="status">{feedback.text}</p>}
    </form>
  );
}
