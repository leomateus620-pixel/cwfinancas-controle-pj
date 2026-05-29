import { describe, expect, it } from "vitest";
import {
  MAX_MEETING_DURATION_MS,
  buildAutosavePayload,
  buildFinalTranscript,
  buildTopicSummary,
  cleanTranscriptSegments,
  dedupeTranscriptSegments,
  detectMeetingInstability,
  shouldAutoFinishMeeting,
} from "../meetingRecorderUtils";

describe("meeting recorder utils", () => {
  it("deduplica segmentos", () => {
    expect(dedupeTranscriptSegments(["A", "a ", "B"]).length).toBe(2);
  });

  it("monta transcript final sem mock", () => {
    const t = buildFinalTranscript(["primeira fala", "primeira fala"], "interim", "manual");
    expect(t).toContain("primeira fala");
    expect(t).not.toContain("mock");
  });

  it("limpa repeticoes, falas quebradas e prefixos de locutor", () => {
    const transcript = cleanTranscriptSegments([
      "Ana: vamos revisar receita de maio",
      "vamos revisar receita de maio",
      "Cliente: preciso da DRE ate sexta sexta",
    ]);
    expect(transcript).toEqual(["vamos revisar receita de maio", "preciso da DRE ate sexta"]);
  });

  it("respeita limite de 5 horas", () => {
    expect(MAX_MEETING_DURATION_MS).toBe(5 * 60 * 60 * 1000);
    expect(shouldAutoFinishMeeting(0, MAX_MEETING_DURATION_MS + 1)).toBe(true);
  });

  it("build topic summary com texto real", () => {
    const s = buildTopicSummary(
      "Ficou decidido revisar orcamento. Ana responsavel por entregar em 10/10. Cliente pediu DRE. Risco de atraso.",
    );
    expect(s.decisions.length).toBeGreaterThan(0);
    expect(s.actions.length).toBeGreaterThan(0);
    expect(s.clientRequests.length).toBeGreaterThan(0);
    expect(s.dueDates).toContain("10/10");
  });

  it("detecta oscilacao operacional sem bloquear finalizacao", () => {
    const status = detectMeetingInstability({ recognitionUnstable: true, autosaveError: true });
    expect(status.status).toBe("attention");
    expect(status.events.length).toBe(2);
  });

  it("monta payload de autosave", () => {
    const payload = buildAutosavePayload({
      meeting_session_id: "id",
      transcript_text: "texto",
      transcript_segments: ["a"],
      live_transcript_segments: ["a", "b"],
      duration_seconds: 10,
    });
    expect(payload.action).toBe("autosave_session");
  });
});
