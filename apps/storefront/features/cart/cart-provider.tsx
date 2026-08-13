"use client";

import { browserApi } from "@/services/api-client";
import type { Cart } from "@/types/api";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const CART_TOKEN_KEY = "atelier.cart.token";

type AddItem = { productId: string; variantId?: string; quantity: number; personalization?: Record<string, string> };
type CartContextValue = {
  cart: Cart | null;
  itemCount: number;
  loading: boolean;
  error: string | null;
  addItem(input: AddItem): Promise<void>;
  updateItem(id: string, quantity: number): Promise<void>;
  removeItem(id: string): Promise<void>;
  refresh(): Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const tokenRef = useRef<string | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureToken = useCallback(async (): Promise<string> => {
    if (tokenRef.current) return tokenRef.current;
    const stored = window.localStorage.getItem(CART_TOKEN_KEY);
    if (stored) {
      tokenRef.current = stored;
      return stored;
    }
    const created = await browserApi<{ token: string }>("/carts", { method: "POST" });
    window.localStorage.setItem(CART_TOKEN_KEY, created.token);
    tokenRef.current = created.token;
    return created.token;
  }, []);

  const requestCart = useCallback(async (path: string, init: RequestInit = {}): Promise<Cart> => {
    const token = await ensureToken();
    const headers = new Headers(init.headers);
    headers.set("x-cart-token", token);
    return browserApi<Cart>(path, { ...init, headers });
  }, [ensureToken]);

  const refresh = useCallback(async () => {
    const stored = window.localStorage.getItem(CART_TOKEN_KEY);
    if (!stored) return;
    tokenRef.current = stored;
    setLoading(true);
    try {
      setCart(await requestCart("/carts/current"));
      setError(null);
    } catch {
      window.localStorage.removeItem(CART_TOKEN_KEY);
      tokenRef.current = null;
      setCart(null);
    } finally {
      setLoading(false);
    }
  }, [requestCart]);

  useEffect(() => {
    const stored = window.localStorage.getItem(CART_TOKEN_KEY);
    if (!stored) return;
    let active = true;
    tokenRef.current = stored;
    void requestCart("/carts/current")
      .then((current) => { if (active) { setCart(current); setError(null); } })
      .catch(() => {
        if (!active) return;
        window.localStorage.removeItem(CART_TOKEN_KEY);
        tokenRef.current = null;
        setCart(null);
      });
    return () => { active = false; };
  }, [requestCart]);

  const mutate = useCallback(async (path: string, init: RequestInit) => {
    setLoading(true);
    try {
      setCart(await requestCart(path, init));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "L'opération a échoué.");
      throw caught;
    } finally {
      setLoading(false);
    }
  }, [requestCart]);

  const value = useMemo<CartContextValue>(() => ({
    cart,
    itemCount: cart?.items.reduce((count, item) => count + item.quantity, 0) ?? 0,
    loading,
    error,
    addItem: (input) => mutate("/carts/items", { method: "POST", body: JSON.stringify(input) }),
    updateItem: (id, quantity) => mutate(`/carts/items/${id}`, { method: "PATCH", body: JSON.stringify({ quantity }) }),
    removeItem: (id) => mutate(`/carts/items/${id}`, { method: "DELETE" }),
    refresh,
  }), [cart, error, loading, mutate, refresh]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}

export function getStoredCartToken(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(CART_TOKEN_KEY);
}
