import type { Metadata } from "next";
import { AdminLoginForm } from "@/features/admin/admin-login-form";

export const metadata: Metadata = { title: "Connexion administration", robots: { index: false, follow: false } };
export default function AdminLoginPage() { return <AdminLoginForm />; }
