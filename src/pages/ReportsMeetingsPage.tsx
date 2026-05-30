import { useMemo, useState } from "react";
import { Activity, BarChart3, CheckCircle2, Clock } from "lucide-react";
import { CategoryComparisonCard } from "@/features/reports-meetings/components/CategoryComparisonCard";
import { FinalComparisonPanel } from "@/features/reports-meetings/components/FinalComparisonPanel";
import { MeetingRecorderPanel } from "@/features/reports-meetings/components/MeetingRecorderPanel";
import { MeetingTranscriptPanel } from "@/features/reports-meetings/components/MeetingTranscriptPanel";
import { PreMeetingReportPanel } from "@/features/reports-meetings/components/PreMeetingReportPanel";
import { ReportPdfPreview } from "@/features/reports-meetings/components/ReportPdfPreview";
import { MeetingsHistoryPanel } from "@/features/reports-meetings/components/MeetingsHistoryPanel";
import { ReportsMeetingsHero } from "@/features/reports-meetings/components/ReportsMeetingsHero";
import { SmartTopicIsland } from "@/features/reports-meetings/components/SmartTopicIsland";
import { MeetingSourcePickerCard } from "@/features/reports-meetings/components/MeetingSourcePickerCard";
import { MetricCard } from "@/features/reports-meetings/components/reportsMeetingUi";
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
        title: "Relatório gerado",
        description: `${result.analysis.latestSheetName} analisada e XLSX atualizado pronto.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao gerar relatório",
        description: error instanceof Error ? error.message : "Falha desconhecida",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="home-glass-bg -m-5 min-h-[calc(100vh-64px)] space-y-4 p-4 sm:space-y-5 sm:p-5 md:-m-6 md:p-6">
      <ReportsMeetingsHero
        onGenerate={() => void generatePreMeetingReport()}
        onStartMeeting={recorder.start}
        isGenerating={reportGeneration.isPending}
      />

      <div className="mx-auto grid max-w-[1540px] gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard className="min-h-[124px]" label="Relatórios gerados" value={reportPackage ? "1 pronto" : "Aguardando"} detail="Pré-reunião" tone={reportPackage ? "success" : "neutral"} icon={<BarChart3 className="h-4 w-4" />} />
        <MetricCard className="min-h-[124px]" label="Reuniões gravadas" value={recorder.topicSummary ? "1 finalizada" : "Em aberto"} detail="Modo acompanhamento" tone={recorder.topicSummary ? "success" : "info"} icon={<Activity className="h-4 w-4" />} />
        <MetricCard className="min-h-[124px]" label="Ações pendentes" value={recorder.topicSummary?.actions.length ?? 0} detail="Após a reunião" tone="warning" icon={<CheckCircle2 className="h-4 w-4" />} />
        <MetricCard className="min-h-[124px]" label="Última comparação" value={comparison ? `${comparison.alignmentScore}%` : "Pendente"} detail="Relatório x reunião" tone={comparison ? "success" : "neutral"} icon={<Clock className="h-4 w-4" />} />
      </div>

      <div className="mx-auto grid max-w-[1540px] gap-4 sm:gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
        <div className="space-y-5">
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

        <div className="space-y-5">
          <CategoryComparisonCard reportPackage={reportPackage} />
          <MeetingTranscriptPanel
            lines={recorder.transcriptLines}
            interimTranscript={recorder.interimTranscript}
            status={recorder.status}
            manualTranscript={recorder.manualTranscript}
            onManualTranscriptChange={recorder.setManualTranscript}
            recognitionUnstable={recorder.recognitionUnstable}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <SmartTopicIsland
              title="Ponto falado"
              summary="Os principais assuntos capturados aparecem no resumo pós-reunião para validação executiva."
            />
            <SmartTopicIsland
              title="Próximas ações"
              summary="As ações detectadas serão consolidadas com responsáveis, prazos e prioridades."
            />
          </div>
          <FinalComparisonPanel topicSummary={recorder.topicSummary} comparison={comparison} />
          <MeetingsHistoryPanel />
        </div>
      </div>
    </div>
  );
}
