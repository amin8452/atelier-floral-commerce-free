function storeInitials(storeName: string): string {
  return storeName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toLocaleUpperCase() ?? "")
    .join("") || "AF";
}

export function BrandLockup({ storeName }: { storeName: string }) {
  return (
    <span className="brand-lockup">
      <span className="brand-monogram" aria-hidden="true">{storeInitials(storeName)}</span>
      <span className="brand-wordmark">
        <strong>{storeName}</strong>
        <small>Bijoux en résine</small>
      </span>
    </span>
  );
}
