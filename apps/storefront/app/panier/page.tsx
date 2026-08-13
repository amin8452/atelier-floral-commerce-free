import type { Metadata } from "next";
import { CartPage } from "@/features/cart/cart-page";

export const metadata: Metadata = { title: "Panier" };
export default function Page() { return <CartPage />; }
