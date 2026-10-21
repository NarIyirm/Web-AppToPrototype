import type { PairingOffer, TransferReceipt } from '@/core/pairing';

export const transferAvailable = false;
export async function pairDesktop(_offer: PairingOffer): Promise<string> { throw new Error('扫码直传需要手机安装包。'); }
export async function transferBundle(_bundle: { uri: string; packageId: string }, _progress: (value: number) => void, _cancel: () => boolean): Promise<TransferReceipt> { throw new Error('扫码直传需要手机安装包。'); }
export async function disconnectDesktop() {}
export function connectedDesktop(): string | null { return null; }
export async function checkDesktopConnection() { return false; }
