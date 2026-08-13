export function buildStoreWhatsAppUrl(number: string | null, message?: string): string | null {
  if (!number) return null;

  const normalizedNumber = number.replace(/[^0-9]/g, "");
  if (normalizedNumber.length < 6 || normalizedNumber.length > 15) return null;

  const baseUrl = `https://wa.me/${normalizedNumber}`;
  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
}
