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

export default function ReportsMeetingsPage() {
  const recorder = useMeetingRecorder();
  return (
    <div className="space-y-4 p-1">
      <ReportsMeetingsHero onGenerate={() => {}} onStartMeeting={recorder.start} />
      <div className="grid gap-4 md:grid-cols-5">
        {["Relatórios gerados", "Reuniões gravadas", "Ações pendentes", "Última comparação", "Fontes conectadas"].map((k) => (
          <div key={k} className="rounded-2xl border bg-white/70 p-4 text-sm font-medium">{k}</div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SourceSelectorCard />
        <PreMeetingReportPanel />
        <MeetingRecorderPanel status={recorder.status} start={recorder.start} pause={recorder.pause} finish={recorder.finish} error={recorder.permissionError} />
        <MeetingTranscriptPanel />
        <FinalComparisonPanel />
        <ReportPdfPreview />
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <SmartTopicIsland title="Decisão tomada" summary="Ajustar limite de despesas e revisar contratos até sexta-feira." />
        <SmartTopicIsland title="Divergência" summary="Valor de caixa citado não confere com KPI consolidado." />
        <SmartTopicIsland title="Ação futura" summary="Responsável financeiro validará categorias com comercial." />
      </div>
      <ReportsHistoryTable />
    </div>
  );
}
