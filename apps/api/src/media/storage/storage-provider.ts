export type StoredObject = { key: string; url: string };

export interface StorageProvider {
  save(key: string, content: Buffer, contentType: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");
