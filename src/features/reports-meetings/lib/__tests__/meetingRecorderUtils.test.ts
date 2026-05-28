import { describe, expect, it } from "vitest";
import { MAX_MEETING_DURATION_MS, buildAutosavePayload, buildFinalTranscript, buildTopicSummary, dedupeTranscriptSegments, shouldAutoFinishMeeting } from "../meetingRecorderUtils";

describe("meeting recorder utils", () => {
  it("deduplica segmentos", () => {
    expect(dedupeTranscriptSegments(["A", "a ", "B"]).length).toBe(2);
  });

  it("monta transcript final sem mock", () => {
    const t = buildFinalTranscript(["primeira fala", "primeira fala"], "interim", "manual");
    expect(t).toContain("primeira fala");
    expect(t).not.toContain("mock");
  });

  it("respeita limite de 5 horas", () => {
    expect(MAX_MEETING_DURATION_MS).toBe(5 * 60 * 60 * 1000);
    expect(shouldAutoFinishMeeting(0, MAX_MEETING_DURATION_MS + 1)).toBe(true);
  });

  it("build topic summary com texto real", () => {
    const s = buildTopicSummary("Ficou decidido revisar orçamento. Ana responsável por entregar em 10/10. Risco de atraso.");
    expect(s.decisions.length).toBeGreaterThan(0);
    expect(s.actions.length).toBeGreaterThan(0);
  });

  it("monta payload de autosave", () => {
    const payload = buildAutosavePayload({ meeting_session_id: "id", transcript_text: "texto", transcript_segments: ["a"], live_transcript_segments: ["a", "b"], duration_seconds: 10 });
    expect(payload.action).toBe("autosave_session");
  });
});
