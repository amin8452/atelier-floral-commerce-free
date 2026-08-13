import type { AdminMedia } from "@/types/admin";

export function uploadMediaAsset(
  file: File,
  altText: string,
  onProgress?: (value: number) => void,
): Promise<AdminMedia> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.set("file", file);
    body.set("altText", altText.trim() || imageName(file.name));

    const request = new XMLHttpRequest();
    request.open("POST", "/backend/api/media/admin");
    request.withCredentials = true;
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () => {
      const response = safeJson(request.responseText);
      if (request.status >= 200 && request.status < 300 && response && "id" in response) {
        resolve(response as AdminMedia);
        return;
      }
      const rawMessage = response && "message" in response ? response.message : undefined;
      const message = typeof rawMessage === "string"
        ? rawMessage
        : Array.isArray(rawMessage) && rawMessage.every((item) => typeof item === "string")
          ? rawMessage.join(" ")
          : "Le téléversement a échoué.";
      reject(new Error(message));
    });
    request.addEventListener("error", () => reject(new Error("Le téléversement a échoué. Vérifiez votre connexion.")));
    request.send(body);
  });
}

export function imageName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replaceAll(/[-_]+/g, " ").trim() || "Image du produit";
}

function safeJson(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
