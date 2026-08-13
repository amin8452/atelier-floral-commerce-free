"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type NotificationTone = "success" | "error" | "warning" | "info";
export type NotificationInput = {
  title: string;
  message?: string;
  tone?: NotificationTone;
  duration?: number;
};

type Notification = NotificationInput & { id: number };
type NotificationContextValue = { notify: (notification: NotificationInput) => void };

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const sequence = useRef(0);
  const timers = useRef(new Map<number, number>());
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  }, []);

  const notify = useCallback((input: NotificationInput) => {
    sequence.current += 1;
    const notification = { ...input, id: sequence.current, tone: input.tone ?? "success" };
    setNotifications((current) => [...current, notification]);
    timers.current.set(notification.id, window.setTimeout(() => dismiss(notification.id), input.duration ?? 4500));
  }, [dismiss]);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="admin-toast-region" aria-live="polite" aria-label="Notifications">
        {notifications.map((notification) => (
          <article className={`admin-toast ${notification.tone}`} key={notification.id} role={notification.tone === "error" ? "alert" : "status"}>
            <span className="admin-toast-icon" aria-hidden="true">{toneIcon(notification.tone)}</span>
            <div>
              <strong>{notification.title}</strong>
              {notification.message && <p>{notification.message}</p>}
            </div>
            <button type="button" onClick={() => dismiss(notification.id)} aria-label="Fermer la notification">×</button>
          </article>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used inside NotificationProvider");
  return context;
}

function toneIcon(tone: NotificationTone | undefined) {
  if (tone === "error") return "!";
  if (tone === "warning") return "!";
  if (tone === "info") return "i";
  return "✓";
}
