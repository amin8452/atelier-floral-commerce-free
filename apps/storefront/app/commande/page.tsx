import type { Metadata } from "next";
import { CheckoutForm } from "@/features/checkout/checkout-form";
import { getPublicSettings } from "@/services/settings";

export const metadata: Metadata = { title: "Commande" };
export default async function CheckoutPage() { return <CheckoutForm settings={await getPublicSettings()} />; }
