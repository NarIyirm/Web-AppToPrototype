export type ByteSink = { write(bytes: Uint8Array): void; finish(): Promise<string>; abort(): void };
export type StorageIO = {
  readSlots(): Promise<(string | null)[]>;
  writeSlot(slot: number, data: string): Promise<void>;
  putAsset(id: string, data: Uint8Array): Promise<void>;
  readAsset(id: string): Promise<Uint8Array>;
  assetUri(id: string): Promise<string>;
  createExport(name: string): Promise<ByteSink>;
  shareExport(uri: string): Promise<void>;
};
