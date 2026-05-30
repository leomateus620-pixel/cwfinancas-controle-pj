import { useMemo, useState } from "react";
import { GlassCard } from "@/components/home/GlassCard";
import { FinalComparisonPanel } from "@/features/reports-meetings/components/FinalComparisonPanel";
import { MeetingRecorderPanel } from "@/features/reports-meetings/components/MeetingRecorderPanel";
import { MeetingTranscriptPanel } from "@/features/reports-meetings/components/MeetingTranscriptPanel";
import { PreMeetingReportPanel } from "@/features/reports-meetings/components/PreMeetingReportPanel";
import { ReportPdfPreview } from "@/features/reports-meetings/components/ReportPdfPreview";
import { MeetingsHistoryPanel } from "@/features/reports-meetings/components/MeetingsHistoryPanel";
import { ReportsMeetingsHero } from "@/features/reports-meetings/components/ReportsMeetingsHero";
import { SmartTopicIsland } from "@/features/reports-meetings/components/SmartTopicIsland";
import { MeetingSourcePickerCard } from "@/features/reports-meetings/components/MeetingSourcePickerCard";
import { useMeetingRecorder } from "@/features/reports-meetings/hooks/useMeetingRecorder";
import { useMeetingSources } from "@/features/reports-meetings/hooks/useMeetingSources";
import { useReportGeneration } from "@/features/reports-meetings/hooks/useReportGeneration";
import { buildFinalTranscript } from "@/features/reports-meetings/lib/meetingRecorderUtils";
import { buildConsolidatedMeetingReport } from "@/features/reports-meetings/lib/meetingComparison";
import { downloadUpdatedWorkbook } from "@/features/reports-meetings/lib/updatedWorkbookExport";
import type { ReportsMeetingsPackage } from "@/features/reports-meetings/lib/financialWorkbook";
import { toast } from "@/hooks/use-toast";

export default function ReportsMeetingsPage() {
  const recorder = useMeetingRecorder();
  const { sources } = useMeetingSources();
  const reportGeneration = useReportGeneration();
  const [reportPackage, setReportPackage] = useState<ReportsMeetingsPackage | null>(null);

  const transcriptText = useMemo(
    () => buildFinalTranscript(recorder.transcriptLines, recorder.interimTranscript, recorder.manualTranscript),
    [recorder.interimTranscript, recorder.manualTranscript, recorder.transcriptLines],
  );

  const comparison = useMemo(() => {
    if (!reportPackage || !recorder.topicSummary) return null;
    return buildConsolidatedMeetingReport({
      preMeetingReport: reportPackage.report,
      topicSummary: recorder.topicSummary,
      transcriptText,
    });
  }, [reportPackage, recorder.topicSummary, transcriptText]);

  async function generatePreMeetingReport() {
    try {
      const result = await reportGeneration.mutateAsync({ sources });
      setReportPackage(result);
      toast({
        title: "Relatorio gerado",
        description: `${result.analysis.latestSheetName} analisada e XLSX atualizado pronto.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao gerar relatorio",
        description: error instanceof Error ? error.message : "Falha desconhecida",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-4 p-1">
      <ReportsMeetingsHero
        onGenerate={() => void generatePreMeetingReport()}
        onStartMeeting={recorder.start}
        isGenerating={reportGeneration.isPending}
      />

      <div className="grid gap-3 md:grid-cols-4">
        {[
          ["Relatorios gerados", reportPackage ? "1 pronto" : "aguardando"],
          ["Reunioes gravadas", recorder.topicSummary ? "1 finalizada" : "em aberto"],
          ["Acoes pendentes", recorder.topicSummary?.actions.length ?? 0],
          ["Ultima comparacao", comparison ? `${comparison.alignmentScore}%` : "pendente"],
        ].map(([label, value]) => (
          <GlassCard key={String(label)} variant="compact" className="p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-semibold">{value}</p>
          </GlassCard>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-4">
          <MeetingSourcePickerCard />
          <PreMeetingReportPanel
            reportPackage={reportPackage}
            isLoading={reportGeneration.isPending}
            error={reportGeneration.error?.message}
            onDownloadWorkbook={reportPackage ? () => downloadUpdatedWorkbook(reportPackage) : undefined}
          />
          <MeetingRecorderPanel
            status={recorder.status}
            start={recorder.start}
            pause={recorder.pause}
            resume={recorder.resume}
            finish={recorder.finish}
            error={recorder.permissionError}
            isSpeechSupported={recorder.isSpeechSupported}
            persistenceMode={recorder.persistenceMode}
            durationMs={recorder.durationMs}
            autosaveState={recorder.autosaveState}
            recognitionRestarted={recorder.recognitionRestarted}
            recognitionUnstable={recorder.recognitionUnstable}
            finalizationStage={recorder.finalizationStage}
            hasBackendSession={recorder.hasBackendSession}
            operationalEvents={recorder.operationalEvents}
            operationalStatus={recorder.operationalStatus}
          />
          <ReportPdfPreview />
        </div>

        <div className="space-y-4">
          <MeetingTranscriptPanel
            lines={recorder.transcriptLines}
            interimTranscript={recorder.interimTranscript}
            status={recorder.status}
            manualTranscript={recorder.manualTranscript}
            onManualTranscriptChange={recorder.setManualTranscript}
            recognitionUnstable={recorder.recognitionUnstable}
          />
          <div className="grid gap-2 md:grid-cols-2">
            <SmartTopicIsland
              title="Ponto falado"
              summary="Os cards crescem com a conversa, com limite e rolagem continua."
            />
            <SmartTopicIsland
              title="Divergencia"
              summary="Numeros nao confirmados ficam sinalizados para revisao ao final."
            />
          </div>
          <FinalComparisonPanel topicSummary={recorder.topicSummary} comparison={comparison} />
        </div>
      </div>

      <MeetingsHistoryPanel />
    </div>
  );
}
