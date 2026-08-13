import type { Metadata } from "next";
import { OrderConfirmation } from "@/features/checkout/order-confirmation";

export const metadata: Metadata = { title: "Commande confirmée", robots: { index: false, follow: false } };
export default async function ConfirmationPage({ searchParams }: { searchParams: Promise<{ numero?: string }> }) { const { numero } = await searchParams; return <OrderConfirmation orderNumber={numero ?? null} />; }
