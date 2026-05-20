import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  APP_VERSION,
  canReloadNow,
  clearAppCaches,
  fetchRemoteVersion,
  markReloadAttempt,
} from "@/lib/version";

const IDLE_MS = 10 * 60 * 1000; // 10 minutes
const POLL_MS = 5 * 60 * 1000; // 5 minutes
const ACTIVITY_EVENTS = [
  "mousemove",
  "keydown",
  "click",
  "scroll",
  "touchstart",
] as const;

const DEV = import.meta.env.DEV;

function log(...args: unknown[]) {
  if (DEV) console.info("[version]", ...args);
}

export function useAppVersionCheck() {
  const isCheckingRef = useRef(false);
  const isUpdatingRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const wasIdleRef = useRef(false);

  useEffect(() => {
    let pollId: ReturnType<typeof setInterval> | null = null;
    let mounted = true;

    const performUpdate = async () => {
      if (isUpdatingRef.current) return;
      isUpdatingRef.current = true;
      if (!canReloadNow()) {
        toast.message("Não foi possível atualizar automaticamente", {
          description: "Feche e abra o sistema novamente.",
        });
        isUpdatingRef.current = false;
        return;
      }
      markReloadAttempt();
      toast.message("Nova versão disponível", {
        description: "Atualizando o sistema...",
      });
      await clearAppCaches();
      log("reloading to fetch new version");
      // Small delay so the toast is visible
      setTimeout(() => {
        window.location.reload();
      }, 600);
    };

    const checkVersion = async (reason: string) => {
      if (isCheckingRef.current || isUpdatingRef.current) return;
      if (document.visibilityState !== "visible") return;
      isCheckingRef.current = true;
      try {
        const remote = await fetchRemoteVersion();
        if (!mounted || !remote) return;
        log("check", reason, { local: APP_VERSION, remote: remote.version });
        if (
          APP_VERSION !== "dev" &&
          remote.version &&
          remote.version !== APP_VERSION
        ) {
          await performUpdate();
        }
      } finally {
        isCheckingRef.current = false;
      }
    };

    // Initial check on mount
    checkVersion("mount");

    // Activity tracking for idle detection
    const onActivity = () => {
      const now = Date.now();
      const wasIdle = wasIdleRef.current;
      lastActivityRef.current = now;
      if (wasIdle) {
        wasIdleRef.current = false;
        checkVersion("post-idle");
      }
    };

    // Idle marker (checks every 30s if user has been idle past threshold)
    const idleTicker = setInterval(() => {
      if (Date.now() - lastActivityRef.current > IDLE_MS) {
        wasIdleRef.current = true;
      }
    }, 30_000);

    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, onActivity, { passive: true })
    );

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Returning to tab is a strong trigger
        checkVersion("visibility");
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Lightweight background polling (only fires when tab visible)
    pollId = setInterval(() => checkVersion("poll"), POLL_MS);

    return () => {
      mounted = false;
      if (pollId) clearInterval(pollId);
      clearInterval(idleTicker);
      ACTIVITY_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, onActivity)
      );
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
