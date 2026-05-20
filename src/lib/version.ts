/**
 * Global app versioning for cache busting.
 * APP_VERSION is injected at build time via vite `define`.
 */
declare const __APP_VERSION__: string;
declare const __BUILD_ID__: string;
declare const __DEPLOYED_AT__: string;

export const APP_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";
export const BUILD_ID: string =
  typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";
export const DEPLOYED_AT: string =
  typeof __DEPLOYED_AT__ !== "undefined" ? __DEPLOYED_AT__ : new Date().toISOString();

export interface RemoteVersion {
  version: string;
  buildId: string;
  deployedAt: string;
}

export async function fetchRemoteVersion(): Promise<RemoteVersion | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
      credentials: "omit",
    });
    if (!res.ok) return null;
    return (await res.json()) as RemoteVersion;
  } catch {
    return null;
  }
}

/**
 * Clears technical caches only. Preserves auth (sb-*) and user data.
 */
export async function clearAppCaches(): Promise<void> {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* noop */
  }
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("cwf-version-")) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* noop */
  }
}

const RELOAD_KEY = "cwf-version-last-reload";
const RELOAD_COOLDOWN_MS = 30_000;

export function canReloadNow(): boolean {
  try {
    const raw = sessionStorage.getItem(RELOAD_KEY);
    if (!raw) return true;
    const last = Number(raw);
    if (Number.isNaN(last)) return true;
    return Date.now() - last > RELOAD_COOLDOWN_MS;
  } catch {
    return true;
  }
}

export function markReloadAttempt(): void {
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* noop */
  }
}
