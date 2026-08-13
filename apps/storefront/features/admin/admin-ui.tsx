"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

type DialogSize = "small" | "medium" | "large" | "fullscreen";

export function AdminDialog({
  open,
  title,
  description,
  size = "medium",
  children,
  footer,
  onClose,
  closeLabel = "Fermer",
}: {
  open: boolean;
  title: string;
  description?: string;
  size?: DialogSize;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeLabel?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      const body = panelRef.current?.querySelector<HTMLElement>(".admin-dialog-body");
      const target = body?.querySelector<HTMLElement>("[autofocus]")
        ?? body?.querySelector<HTMLElement>("input:not([type='hidden']), select, textarea")
        ?? body?.querySelector<HTMLElement>("button");
      (target ?? panelRef.current)?.focus();
    });
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", keydown);
      previousFocus?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="admin-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        className={`admin-dialog admin-dialog-${size}`}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <header className="admin-dialog-header">
          <div>
            <p className="eyebrow">Administration</p>
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>
          <button className="admin-dialog-close" type="button" onClick={onClose} aria-label={closeLabel}>×</button>
        </header>
        <div className="admin-dialog-body">{children}</div>
        {footer && <footer className="admin-dialog-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  busy = false,
  destructive = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AdminDialog open={open} title={title} description={message} size="small" onClose={onClose}>
      <div className="admin-dialog-actions">
        <button className="button secondary" type="button" onClick={onClose} disabled={busy}>Annuler</button>
        <button className={`button ${destructive ? "danger filled" : ""}`} type="button" onClick={onConfirm} disabled={busy}>
          {busy ? "Traitement…" : confirmLabel}
        </button>
      </div>
    </AdminDialog>
  );
}

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-page-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function InlineError({ message }: { message: string | null }) {
  return message ? <p className="form-message error" role="alert">{message}</p> : null;
}
