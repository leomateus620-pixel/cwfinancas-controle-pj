import { CheckCircle, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SyncTabAudit } from "@/hooks/useSyncAudit";

interface SyncAuditTableProps {
  audits: SyncTabAudit[];
}

export function SyncAuditTable({ audits }: SyncAuditTableProps) {
  if (audits.length === 0) return null;

  const totals = audits.reduce(
    (acc, a) => ({
      scanned: acc.scanned + a.rows_scanned,
      withValue: acc.withValue + a.rows_with_value,
      imported: acc.imported + a.rows_imported,
      skipped: acc.skipped + a.rows_skipped,
    }),
    { scanned: 0, withValue: 0, imported: 0, skipped: 0 }
  );

  const totalDiff = totals.withValue - totals.imported;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">Auditoria por Aba</h4>
        <Badge variant={totalDiff === 0 ? "default" : "destructive"} className="text-xs">
          {totalDiff === 0 ? (
            <span className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3" /> 100% importado
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {totalDiff} linhas faltando
            </span>
          )}
        </Badge>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Aba</TableHead>
            <TableHead className="text-right">Lidas</TableHead>
            <TableHead className="text-right">Com Valor</TableHead>
            <TableHead className="text-right">Importadas</TableHead>
            <TableHead className="text-right">Diferença</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {audits.map((audit) => {
            const diff = audit.rows_with_value - audit.rows_imported;
            return (
              <TableRow key={audit.id}>
                <TableCell className="font-medium">{audit.tab_name}</TableCell>
                <TableCell className="text-right text-muted-foreground">{audit.rows_scanned}</TableCell>
                <TableCell className="text-right">{audit.rows_with_value}</TableCell>
                <TableCell className="text-right">{audit.rows_imported}</TableCell>
                <TableCell className="text-right">
                  {diff === 0 ? (
                    <span className="text-muted-foreground">0</span>
                  ) : (
                    <span className="text-destructive font-medium">{diff}</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {diff === 0 ? (
                    <Badge variant="outline" className="text-xs border-success/50 text-success">OK</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">FALHA</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          {/* Totals row */}
          <TableRow className="font-semibold border-t-2">
            <TableCell>Total</TableCell>
            <TableCell className="text-right">{totals.scanned}</TableCell>
            <TableCell className="text-right">{totals.withValue}</TableCell>
            <TableCell className="text-right">{totals.imported}</TableCell>
            <TableCell className="text-right">
              {totalDiff === 0 ? (
                <span className="text-muted-foreground">0</span>
              ) : (
                <span className="text-destructive">{totalDiff}</span>
              )}
            </TableCell>
            <TableCell className="text-center">
              {totalDiff === 0 ? (
                <Badge variant="outline" className="text-xs border-success/50 text-success">OK</Badge>
              ) : (
                <Badge variant="destructive" className="text-xs">FALHA</Badge>
              )}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
