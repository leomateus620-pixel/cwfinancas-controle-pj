import { Button } from "@/components/ui/button";
import { exportElementAsPdf } from "../lib/pdfExport";
export function ReportPdfPreview(){return <div className="rounded-2xl border bg-white/70 p-4"><Button variant="outline" onClick={()=>exportElementAsPdf("pre-meeting-report","relatorio-pre-reuniao")}>Exportar PDF</Button></div>}
