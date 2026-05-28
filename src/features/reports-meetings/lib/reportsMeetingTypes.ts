export type SourceType = "google_sheets" | "google_docs" | "manual";
export type Confidence = "high" | "medium" | "low";
export type ReportStatus = "draft" | "processing" | "ready" | "error";
export type MeetingStatus = "scheduled" | "recording" | "paused" | "waiting_transcription" | "processing" | "finished" | "error";

export interface MeetingSource {
  id: string;
  source_type: SourceType;
  external_id?: string | null;
  external_name: string;
  metadata?: Record<string, unknown>;
}

export interface FinancialKpi {
  label: string;
  value: number | null;
  confidence: Confidence;
}

export interface PreMeetingReportPayload {
  title: string;
  period_start?: string;
  period_end?: string;
  source_ids: string[];
  executive_summary: string;
  insights: string[];
  risks: string[];
  suggested_agenda: string[];
  report_json: Record<string, unknown>;
}

export interface MeetingActionItem {
  text: string;
  owner?: string;
  dueDate?: string;
  priority: "high" | "medium" | "low";
  status: "open" | "in_progress" | "done";
}
