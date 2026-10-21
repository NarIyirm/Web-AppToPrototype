import { randomUUID } from 'expo-crypto';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { addCapture, addProject, commit, emptyManifest, type Asset, type Capture, type Manifest } from '@/core/project';

import { Repository } from './repository';
import { storage } from './storage';

type AppState = { state: Manifest; loading: boolean; error: string | null; notice: string | null;
  retry(): void; update(change: (state: Manifest) => Manifest): Promise<Manifest>;
  createProject(name: string): Promise<string>;
  saveCaptures(projectId: string, items: { asset: Asset; extras?: Partial<Pick<Capture, 'title' | 'sourceKind' | 'observations' | 'warnings'>> }[]): Promise<string[]>;
  saveCapture(projectId: string, asset: Asset, extras?: Partial<Pick<Capture, 'title' | 'sourceKind' | 'sourceUrl' | 'webNodes' | 'observations' | 'warnings' | 'redacted' | 'logicalWidth' | 'logicalHeight' | 'coordinateSpace'>>): Promise<string>;
};
const Context = createContext<AppState | null>(null);
export const newId = (prefix: string) => `${prefix}-${randomUUID()}`;
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [repository] = useState(() => new Repository(storage));
  const [state, setState] = useState(emptyManifest);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    repository.load().then((result) => {
      if (!alive) return;
      setState(result.state); setError(null); setLoading(false);
      if (result.recovered) setNotice('检测到上次写入中断，已恢复最近有效项目。');
    }).catch((cause: unknown) => {
      if (alive) { setError(cause instanceof Error ? cause.message : '本地项目无法读取。'); setLoading(false); }
    });
    return () => { alive = false; };
  }, [repository, attempt]);
  const update = useCallback(async (change: (current: Manifest) => Manifest) => {
    const next = await repository.update(change);
    setState(next);
    return next;
  }, [repository]);
  const createProject = useCallback(async (name: string) => {
    const id = newId('p');
    await update((current) => addProject(current, id, name, new Date().toISOString()));
    return id;
  }, [update]);
  const saveCapture = useCallback(async (projectId: string, asset: Asset,
    extras: Parameters<AppState['saveCapture']>[2] = {}) => {
    const id = newId('c');
    await update((current) => addCapture(current, { id, projectId, title: `画面 ${current.captures.filter((item) => item.projectId === projectId).length + 1}`,
      createdAt: new Date().toISOString(), sourceKind: 'imported_image', platform: Platform.OS,
      assetId: asset.id, width: asset.width, height: asset.height, observations: [], webNodes: [],
      logicalWidth: asset.width, logicalHeight: asset.height, coordinateSpace: 'image_pixels',
      warnings: ['图片素材，尚未转换为可编辑图层。'], redacted: false, ...extras }, asset));
    return id;
  }, [update]);
  const saveCaptures = useCallback(async (projectId: string, items: Parameters<AppState['saveCaptures']>[1]) => {
    if (!items.length || items.length > 5) throw new Error('每次请选择 1–5 个画面。');
    const ids = items.map(() => newId('c'));
    await update(current => {
      let next = current;
      for (const [index, item] of items.entries()) next = addCapture(next, {
        id: ids[index], projectId, title: `App 画面 ${index + 1}`, createdAt: new Date().toISOString(),
        sourceKind: 'imported_image', platform: Platform.OS, assetId: item.asset.id, width: item.asset.width, height: item.asset.height,
        logicalWidth: item.asset.width, logicalHeight: item.asset.height, coordinateSpace: 'image_pixels', observations: [], webNodes: [],
        warnings: [], redacted: false, ...item.extras,
      }, item.asset);
      return next;
    });
    return ids;
  }, [update]);
  const value = useMemo<AppState>(() => ({ state, loading, error, notice,
    retry: () => { setLoading(true); setAttempt((value) => value + 1); }, update, createProject, saveCapture, saveCaptures }),
  [state, loading, error, notice, update, createProject, saveCapture, saveCaptures]);
  return <Context value={value}>{children}</Context>;
}
export function useAppState() {
  const context = use(Context);
  if (!context) throw new Error('AppStateProvider is missing');
  return context;
}
export function renameProject(state: Manifest, id: string, name: string) {
  return commit(state, (next) => {
    const project = next.projects.find((item) => item.id === id);
    if (!project) throw new Error('项目不存在。');
    project.name = name.trim(); project.updatedAt = new Date().toISOString();
  });
}
