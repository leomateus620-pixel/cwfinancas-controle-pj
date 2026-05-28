import { useState } from "react";

export function useMeetingRecorder() {
  const [status, setStatus] = useState<"idle" | "recording" | "paused" | "blocked">("idle");
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const start = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setStatus("recording");
      setPermissionError(null);
    } catch {
      setStatus("blocked");
      setPermissionError("Sem permissão de microfone");
    }
  };
  return { status, permissionError, start, pause: () => setStatus("paused"), finish: () => setStatus("idle") };
}
