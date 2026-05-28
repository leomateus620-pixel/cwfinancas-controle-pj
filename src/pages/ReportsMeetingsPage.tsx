import { GlassCard } from "@/components/home/GlassCard";
import { FinalComparisonPanel } from "@/features/reports-meetings/components/FinalComparisonPanel";
import { MeetingRecorderPanel } from "@/features/reports-meetings/components/MeetingRecorderPanel";
import { MeetingTranscriptPanel } from "@/features/reports-meetings/components/MeetingTranscriptPanel";
import { PreMeetingReportPanel } from "@/features/reports-meetings/components/PreMeetingReportPanel";
import { ReportPdfPreview } from "@/features/reports-meetings/components/ReportPdfPreview";
import { ReportsHistoryTable } from "@/features/reports-meetings/components/ReportsHistoryTable";
import { MeetingsHistoryPanel } from "@/features/reports-meetings/components/MeetingsHistoryPanel";
import { ReportsMeetingsHero } from "@/features/reports-meetings/components/ReportsMeetingsHero";
import { SmartTopicIsland } from "@/features/reports-meetings/components/SmartTopicIsland";
import { SourceSelectorCard } from "@/features/reports-meetings/components/SourceSelectorCard";
import { useMeetingRecorder } from "@/features/reports-meetings/hooks/useMeetingRecorder";

export default function ReportsMeetingsPage() {
  const recorder = useMeetingRecorder();

  return (
    <div className="space-y-4 p-1">
      <ReportsMeetingsHero onGenerate={() => {}} onStartMeeting={recorder.start} />

      <div className="grid gap-3 md:grid-cols-4">
        {["Relatórios gerados", "Reuniões gravadas", "Ações pendentes", "Última comparação"].map((item) => (
          <GlassCard key={item} variant="compact" className="p-3 text-sm font-medium">
            {item}
          </GlassCard>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          <SourceSelectorCard />
          <PreMeetingReportPanel />
          <MeetingRecorderPanel status={recorder.status} start={recorder.start} pause={recorder.pause} resume={recorder.resume} finish={recorder.finish} error={recorder.permissionError} isSpeechSupported={recorder.isSpeechSupported} persistenceMode={recorder.persistenceMode} durationMs={recorder.durationMs} autosaveState={recorder.autosaveState} recognitionRestarted={recorder.recognitionRestarted} recognitionUnstable={recorder.recognitionUnstable} finalizationStage={recorder.finalizationStage} hasBackendSession={recorder.hasBackendSession} cloudStatus={recorder.cloudStatus} cloudError={recorder.cloudError} />
          <ReportPdfPreview />
        </div>

        <div className="space-y-4">
          <MeetingTranscriptPanel lines={recorder.transcriptLines} interimTranscript={recorder.interimTranscript} status={recorder.status} manualTranscript={recorder.manualTranscript} onManualTranscriptChange={recorder.setManualTranscript} recognitionUnstable={recorder.recognitionUnstable} />
          <div className="grid gap-2 md:grid-cols-2">
            <SmartTopicIsland
              title="Ponto falado"
              summary="Os cards crescem com a conversa, com limite e rolagem contínua."
            />
            <SmartTopicIsland
              title="Divergência"
              summary="Números não confirmados ficam sinalizados para revisão ao final."
            />
          </div>
          <FinalComparisonPanel topicSummary={recorder.topicSummary} />
        </div>
      </div>

      <MeetingsHistoryPanel />

      <ReportsHistoryTable />
    </div>
  );
}