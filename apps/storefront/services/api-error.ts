export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}

export async function createApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as { message?: string | string[]; requestId?: string } | null;
  const message = Array.isArray(body?.message) ? body.message.join(" ") : body?.message ?? "La requête a échoué.";
  return new ApiError(response.status, message, body?.requestId);
}
