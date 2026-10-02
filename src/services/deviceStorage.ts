import { useEffect, useState } from 'react';

// Honest device-storage helpers. Lyra streams from YouTube — there are no
// real offline downloads, so anything showing "MB saved offline" was fiction.
// This module reports what the browser can actually measure.

export interface StorageEstimate {
  usageBytes: number;
  quotaBytes: number;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0KB';
  if (bytes < 1024) return `${Math.round(bytes)}B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)}KB`;
  const mb = kb / 1024;
  if (mb < 1024) {
    if (Number.isInteger(mb)) return `${mb}MB`;
    return mb >= 100 ? `${Math.round(mb)}MB` : `${mb.toFixed(1)}MB`;
  }
  const gb = mb / 1024;
  return `${gb.toFixed(1)}GB`;
}

export async function getStorageEstimate(): Promise<StorageEstimate | null> {
  try {
    const nav = navigator as Navigator & { storage?: { estimate?: () => Promise<{ usage?: number; quota?: number }> } };
    const est = await nav.storage?.estimate?.();
    if (!est) return null;
    return { usageBytes: est.usage ?? 0, quotaBytes: est.quota ?? 0 };
  } catch {
    return null;
  }
}

/** Small hook: resolves once, caches for the session. */
export function useStorageEstimate(): StorageEstimate | null | undefined {
  const [estimate, setEstimate] = useState<StorageEstimate | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    getStorageEstimate().then((est) => {
      if (!cancelled) setEstimate(est);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return estimate;
}

export interface CacheClearResult {
  clearedCaches: number;
  freedBytes: number;
}

// Cover art + font runtime caches (see vite.config.ts `cover-images`,
// `google-fonts-*`). The only thing Lyra can truthfully "free".
export async function clearCoverCaches(): Promise<CacheClearResult> {
  try {
    if (!('caches' in window)) return { clearedCaches: 0, freedBytes: 0 };
    const before = (await getStorageEstimate())?.usageBytes ?? 0;
    const names = await caches.keys();
    const targets = names.filter((n) => n === 'cover-images' || n.startsWith('google-fonts'));
    await Promise.all(targets.map((n) => caches.delete(n)));
    const after = (await getStorageEstimate())?.usageBytes ?? 0;
    return { clearedCaches: targets.length, freedBytes: Math.max(0, before - after) };
  } catch {
    return { clearedCaches: 0, freedBytes: 0 };
  }
}
