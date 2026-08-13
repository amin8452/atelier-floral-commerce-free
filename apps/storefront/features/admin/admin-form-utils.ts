export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Une erreur est survenue.";
}

export function toSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formText(data: FormData, key: string): string {
  return String(data.get(key) ?? "").trim();
}

export function optionalFormText(data: FormData, key: string): string | null {
  return formText(data, key) || null;
}
