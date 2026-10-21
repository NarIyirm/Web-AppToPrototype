/** In-memory, one-use user intent. Route/deep-link parameters alone cannot start an upload. */
export class SendRequests {
  private pending = new Map<string, { signature: string; expiresAt: number }>();
  private signature(projectId: string, ids: string[]) { return JSON.stringify([projectId, [...ids].sort()]); }
  issue(key: string, projectId: string, ids: string[], now = Date.now()) {
    if (!key || !projectId || !ids.length || ids.length > 5 || new Set(ids).size !== ids.length) throw new Error('请选择 1–5 个画面。');
    for (const [id, value] of this.pending) if (value.expiresAt <= now) this.pending.delete(id);
    while (this.pending.size >= 8) this.pending.delete(this.pending.keys().next().value!);
    this.pending.set(key, { signature: this.signature(projectId, ids), expiresAt: now + 15 * 60_000 });
    return key;
  }
  has(key: string, projectId: string, ids: string[], now = Date.now()) {
    const request = this.pending.get(key);
    return !!request && request.expiresAt > now && request.signature === this.signature(projectId, ids);
  }
  claim(key: string, projectId: string, ids: string[], now = Date.now()) {
    if (!this.has(key, projectId, ids, now)) return false;
    this.pending.delete(key); return true;
  }
}
