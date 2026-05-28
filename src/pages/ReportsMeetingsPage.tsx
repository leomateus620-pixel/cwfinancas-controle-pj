import { ReportsMeetingsHero } from "@/features/reports-meetings/components/ReportsMeetingsHero";
import { SourceSelectorCard } from "@/features/reports-meetings/components/SourceSelectorCard";
import { PreMeetingReportPanel } from "@/features/reports-meetings/components/PreMeetingReportPanel";
import { MeetingRecorderPanel } from "@/features/reports-meetings/components/MeetingRecorderPanel";
import { MeetingTranscriptPanel } from "@/features/reports-meetings/components/MeetingTranscriptPanel";
import { SmartTopicIsland } from "@/features/reports-meetings/components/SmartTopicIsland";
import { FinalComparisonPanel } from "@/features/reports-meetings/components/FinalComparisonPanel";
import { ReportsHistoryTable } from "@/features/reports-meetings/components/ReportsHistoryTable";
import { ReportPdfPreview } from "@/features/reports-meetings/components/ReportPdfPreview";
import { useMeetingRecorder } from "@/features/reports-meetings/hooks/useMeetingRecorder";
import { GlassCard } from "@/components/home/GlassCard";

export default function ReportsMeetingsPage() {
  const recorder = useMeetingRecorder();

  return (
    <div className="space-y-4 p-1">
      <ReportsMeetingsHero onGenerate={() => {}} onStartMeeting={recorder.start} />

      <div className="grid gap-3 md:grid-cols-4">
        {["Relatórios gerados", "Reuniões gravadas", "Ações pendentes", "Última comparação"].map((k) => (
          <GlassCard key={k} variant="compact" className="p-3 text-sm font-medium">{k}</GlassCard>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          <SourceSelectorCard />
          <PreMeetingReportPanel />
          <MeetingRecorderPanel
            status={recorder.status}
            start={recorder.start}
            pause={recorder.pause}
            resume={recorder.resume}
            finish={recorder.finish}
            error={recorder.permissionError}
          />
          <ReportPdfPreview />
        </div>

        <div className="space-y-4">
          <MeetingTranscriptPanel lines={recorder.transcriptLines} status={recorder.status} />
          <div className="grid gap-2 md:grid-cols-2">
            <SmartTopicIsland title="Ponto falado" summary="Os cards crescem com a conversa, com limite e rolagem contínua." />
            <SmartTopicIsland title="Divergência" summary="Números não confirmados ficam sinalizados para revisão ao final." />
          </div>
          <FinalComparisonPanel topicSummary={recorder.topicSummary} />
        </div>
      </div>

      <ReportsHistoryTable />
    </div>
  );
}
