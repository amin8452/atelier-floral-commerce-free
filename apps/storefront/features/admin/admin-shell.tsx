"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { ApiError, browserApi } from "@/services/api-client";
import type { AdminUser } from "@/types/admin";
import { NotificationProvider, useNotifications } from "./admin-feedback";
import { adminLabel } from "./admin-labels";
import { AdminProfileDialog } from "./admin-profile-dialog";

const AdminContext = createContext<AdminUser | null>(null);
const allRoles = ["SUPER_ADMIN", "ADMIN", "ORDER_MANAGER", "PRODUCT_MANAGER", "SUPPORT"];
const productRoles = ["SUPER_ADMIN", "ADMIN", "PRODUCT_MANAGER"];
const orderRoles = ["SUPER_ADMIN", "ADMIN", "ORDER_MANAGER"];
const supportRoles = ["SUPER_ADMIN", "ADMIN", "SUPPORT"];
const customerRoles = ["SUPER_ADMIN", "ADMIN", "ORDER_MANAGER", "SUPPORT"];
const ownerRoles = ["SUPER_ADMIN", "ADMIN"];

type IconName = "dashboard" | "orders" | "products" | "collections" | "categories" | "leads" | "customers" | "stock" | "promotions" | "settings" | "users" | "profile" | "logout";
type NavigationEntry = { label: string; href: string; roles: readonly string[]; icon: IconName };
type NavigationGroup = { label: string; entries: readonly NavigationEntry[] };

const navigation: readonly NavigationGroup[] = [
  {
    label: "Pilotage",
    entries: [
      { label: "Vue d’ensemble", href: "/admin", roles: allRoles, icon: "dashboard" },
      { label: "Commandes", href: "/admin/commandes", roles: orderRoles, icon: "orders" },
      { label: "Demandes clients", href: "/admin/leads", roles: supportRoles, icon: "leads" },
      { label: "Clients", href: "/admin/clients", roles: customerRoles, icon: "customers" },
    ],
  },
  {
    label: "Catalogue",
    entries: [
      { label: "Produits", href: "/admin/produits", roles: productRoles, icon: "products" },
      { label: "Collections", href: "/admin/collections", roles: productRoles, icon: "collections" },
      { label: "Catégories", href: "/admin/categories", roles: productRoles, icon: "categories" },
      { label: "Stocks", href: "/admin/stocks", roles: productRoles, icon: "stock" },
      { label: "Promotions", href: "/admin/promotions", roles: ownerRoles, icon: "promotions" },
    ],
  },
  {
    label: "Boutique",
    entries: [
      { label: "Paramètres", href: "/admin/parametres", roles: ownerRoles, icon: "settings" },
      { label: "Utilisateurs", href: "/admin/utilisateurs", roles: ["SUPER_ADMIN"], icon: "users" },
    ],
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(pathname !== "/admin/login");
  const loginPage = pathname === "/admin/login";

  useEffect(() => {
    if (loginPage) return;
    browserApi<{ admin: AdminUser }>("/auth/session")
      .then((result) => setAdmin(result.admin))
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) router.replace("/admin/login");
      })
      .finally(() => setChecking(false));
  }, [loginPage, router]);

  if (loginPage) return children;
  if (checking || !admin) {
    return <div className="admin-loading" role="status"><span className="admin-spinner" aria-hidden="true" />Vérification de votre session…</div>;
  }

  return (
    <NotificationProvider>
      <AdminContext.Provider value={admin}>
        <AdminWorkspace admin={admin} setAdmin={setAdmin}>{children}</AdminWorkspace>
      </AdminContext.Provider>
    </NotificationProvider>
  );
}

function AdminWorkspace({ admin, setAdmin, children }: { admin: AdminUser; setAdmin: Dispatch<SetStateAction<AdminUser | null>>; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { notify } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && setAccountMenuOpen(false);
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [accountMenuOpen]);

  async function logout() {
    try {
      await browserApi("/auth/logout", { method: "POST" });
      setAdmin(null);
      router.replace("/admin/login");
    } catch {
      notify({ title: "Déconnexion impossible", message: "Réessayez dans quelques instants.", tone: "error" });
    }
  }

  const visibleGroups = navigation
    .map((group) => ({ ...group, entries: group.entries.filter((entry) => entry.roles.includes(admin.role)) }))
    .filter((group) => group.entries.length > 0);
  const currentLabel = visibleGroups.flatMap((group) => group.entries).find((entry) => isActive(pathname, entry.href))?.label ?? "Administration";

  return (
    <>
      <a className="skip-link" href="#admin-content">Aller au contenu</a>
      <div className="admin-shell">
        <aside className={menuOpen ? "admin-sidebar open" : "admin-sidebar"} id="admin-navigation">
          <div className="admin-sidebar-head">
            <Link className="admin-brand" href="/admin">
              <span className="admin-brand-mark" aria-hidden="true">AF</span>
              <span>Atelier Floral<small>Espace de gestion</small></span>
            </Link>
            <button className="admin-menu-close" type="button" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu">×</button>
          </div>

          <nav aria-label="Navigation administration">
            {visibleGroups.map((group) => (
              <div className="admin-nav-group" key={group.label}>
                <p>{group.label}</p>
                {group.entries.map(({ label, href, icon }) => {
                  const active = isActive(pathname, href);
                  return (
                    <Link key={href} className={active ? "active" : ""} href={href} aria-current={active ? "page" : undefined} onClick={() => { setMenuOpen(false); setAccountMenuOpen(false); }}>
                      <AdminIcon name={icon} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="admin-account-menu-wrap">
            {accountMenuOpen && (
              <div className="admin-account-popover" role="menu">
                <button type="button" role="menuitem" onClick={() => { setAccountMenuOpen(false); setProfileOpen(true); }}><AdminIcon name="profile" />Mon profil</button>
                <Link href="/" target="_blank" role="menuitem"><AdminIcon name="dashboard" />Voir la boutique</Link>
                <button className="logout" type="button" role="menuitem" onClick={() => void logout()}><AdminIcon name="logout" />Se déconnecter</button>
              </div>
            )}
            <button className="admin-account" type="button" onClick={() => setAccountMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={accountMenuOpen}>
              <span className="admin-avatar" aria-hidden="true">{initials(admin)}</span>
              <span className="admin-account-copy"><strong>{displayName(admin)}</strong><small>{adminLabel(admin.role)}</small></span>
              <span className="admin-account-chevron" aria-hidden="true">⌃</span>
            </button>
          </div>
        </aside>

        {menuOpen && <button className="admin-menu-backdrop" type="button" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu" />}
        <div className="admin-workspace">
          <header className="admin-topbar">
            <button className="admin-menu-toggle" type="button" onClick={() => setMenuOpen(true)} aria-controls="admin-navigation" aria-expanded={menuOpen}><span aria-hidden="true">☰</span><span className="sr-only">Ouvrir le menu</span></button>
            <div><small>Administration</small><strong>{currentLabel}</strong></div>
            <Link className="admin-store-link" href="/" target="_blank">Voir la boutique <span aria-hidden="true">↗</span></Link>
          </header>
          <main className="admin-content" id="admin-content">{children}</main>
        </div>
      </div>

      <AdminProfileDialog open={profileOpen} admin={admin} onClose={() => setProfileOpen(false)} onUpdated={setAdmin} />
    </>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
}

function displayName(admin: AdminUser): string {
  return [admin.firstName, admin.lastName].filter(Boolean).join(" ") || admin.email;
}

function initials(admin: AdminUser): string {
  const value = [admin.firstName, admin.lastName].filter(Boolean).map((part) => part?.[0]).join("");
  return (value || admin.email.slice(0, 2)).toUpperCase();
}

function AdminIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    dashboard: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    orders: "M5 7h14l-1 13H6L5 7Zm3 0a4 4 0 0 1 8 0",
    products: "M12 21c4-3 7-6 7-10a4 4 0 0 0-7-2 4 4 0 0 0-7 2c0 4 3 7 7 10Zm0-12V4",
    collections: "m12 3 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5",
    categories: "M20 13 13 20 4 11V4h7l9 9ZM8 8h.01",
    leads: "M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z",
    customers: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    stock: "M21 8 12 3 3 8l9 5 9-5Zm-18 4 9 5 9-5M3 16l9 5 9-5",
    promotions: "M20 12 12 20 4 12V4h8l8 8ZM8 8h.01",
    settings: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 9 19.37a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.63 15 1.7 1.7 0 0 0 3.08 14H3v-4h.08A1.7 1.7 0 0 0 4.63 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.63h.01A1.7 1.7 0 0 0 10 3.08V3h4v.08A1.7 1.7 0 0 0 15 4.63a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.37 9v.01A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z",
    users: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Zm0-11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm-4 6a4 4 0 0 1 8 0",
    profile: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
    logout: "M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-6",
  };
  return <svg className="admin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function useAdmin(): AdminUser {
  const admin = useContext(AdminContext);
  if (!admin) throw new Error("useAdmin must be used inside AdminShell");
  return admin;
}
