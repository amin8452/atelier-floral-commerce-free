import "server-only";

import { appConfig } from "@/lib/config";
import { createApiError } from "./api-error";

type ServerGetOptions = { revalidate?: number; tags?: string[] };

export async function serverApiGet<T>(path: string, options: ServerGetOptions = {}): Promise<T> {
  const response = await fetch(`${appConfig.serverApiUrl}${path}`, {
    signal: AbortSignal.timeout(5_000),
    next: { revalidate: options.revalidate ?? 60, ...(options.tags ? { tags: options.tags } : {}) },
  });
  if (!response.ok) throw await createApiError(response);
  return response.json() as Promise<T>;
}
