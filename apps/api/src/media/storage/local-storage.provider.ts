import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { getAppConfig } from "../../config/app.config.js";
import { getStorageConfig } from "../../config/storage.config.js";
import type { StorageProvider, StoredObject } from "./storage-provider.js";

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly config: ConfigService) {}

  async save(key: string, content: Buffer, _contentType: string): Promise<StoredObject> {
    const storage = getStorageConfig(this.config);
    if (storage.driver !== "local") throw new Error("Local storage provider is not configured");
    const filePath = this.resolveSafePath(storage.localDirectory, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, { flag: "wx" });
    return {
      key,
      url: `${getAppConfig(this.config).apiUrl.replace(/\/$/, "")}${storage.publicPath}/${key.replaceAll("\\", "/")}`,
    };
  }

  async delete(key: string): Promise<void> {
    const storage = getStorageConfig(this.config);
    if (storage.driver !== "local") throw new Error("Local storage provider is not configured");
    const filePath = this.resolveSafePath(storage.localDirectory, key);
    await unlink(filePath).catch((error: unknown) => {
      if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
    });
  }

  private resolveSafePath(root: string, key: string): string {
    const rootPath = resolve(root);
    const target = resolve(rootPath, key);
    if (!target.startsWith(`${rootPath}${sep}`)) throw new Error("Invalid storage key");
    return target;
  }
}
