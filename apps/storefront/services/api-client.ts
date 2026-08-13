import { createApiError } from "./api-error";

export { ApiError } from "./api-error";

export async function browserApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await fetch(`/backend/api${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (!response.ok) throw await createApiError(response);
  return response.json() as Promise<T>;
}
