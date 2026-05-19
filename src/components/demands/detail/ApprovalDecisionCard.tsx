import { useState } from "react";
import { GlassCard } from "@/components/home/GlassCard";
import { Button } from "@/components/ui/button";
import { useApproveDemand, useRejectDemand, useRequestApproval } from "@/hooks/useApproveDemand";
import { useUserRole } from "@/hooks/useUserRole";
import { RejectModal } from "./RejectModal";
import { Check, X, AlertTriangle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";

export function ApprovalDecisionCard({
  demandId, status, rejectionReason,
}: { demandId: string; status: string; rejectionReason: string | null }) {
  const { isManager } = useUserRole();
  const approve = useApproveDemand();
  const reject = useRejectDemand();
  const request = useRequestApproval();
  const [open, setOpen] = useState(false);

  // Already-resolved states
  if (status === "reprovada" && rejectionReason) {
    return (
      <GlassCard className="p-5 border-rose-200 bg-rose-50/40">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-rose-700">Demanda rejeitada</h3>
            <p className="text-sm text-rose-800/80 mt-1">{rejectionReason}</p>
          </div>
        </div>
      </GlassCard>
    );
  }

  if (!isManager) return null;

  // Internal can request approval
  if (status === "em_analise" || status === "recebida") {
    return (
      <GlassCard className="p-4 flex items-center justify-between gap-3">
        <div className="text-sm">
          <div className="font-medium">Pronto para aprovação?</div>
          <div className="text-xs text-muted-foreground">Encaminhe para que um gestor decida.</div>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => request.mutate(demandId, {
            onSuccess: () => toast.success("Enviada para aprovação"),
            onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
          })}
        >
          <ArrowUpCircle className="w-4 h-4" /> Solicitar aprovação
        </Button>
      </GlassCard>
    );
  }

  if (status !== "aguardando_aprovacao") return null;

  return (
    <>
      <GlassCard className="p-5 border-violet-200 bg-violet-50/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-violet-800">Decisão pendente</h3>
            <p className="text-xs text-violet-700/80 mt-1">
              Aprove para continuar o fluxo ou rejeite com justificativa.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50"
              onClick={() => setOpen(true)}
              disabled={reject.isPending}
            >
              <X className="w-4 h-4" /> Rejeitar
            </Button>
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={() => approve.mutate(demandId, {
                onSuccess: () => toast.success("Demanda aprovada"),
                onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
              })}
              disabled={approve.isPending}
            >
              <Check className="w-4 h-4" /> Aprovar
            </Button>
          </div>
        </div>
      </GlassCard>

      <RejectModal
        open={open}
        onOpenChange={setOpen}
        loading={reject.isPending}
        onConfirm={(reason) =>
          reject.mutate({ id: demandId, reason }, {
            onSuccess: () => { setOpen(false); toast.success("Demanda rejeitada"); },
            onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
          })
        }
      />
    </>
  );
}
