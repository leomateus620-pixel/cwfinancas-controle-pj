import { useAppVersionCheck } from "@/hooks/useAppVersionCheck";

/**
 * Mounts the global app-version watcher. Renders nothing.
 * Detects new deploys (via /version.json) and auto-reloads the page,
 * preserving auth and user data.
 */
export function AppUpdateHandler() {
  useAppVersionCheck();
  return null;
}
