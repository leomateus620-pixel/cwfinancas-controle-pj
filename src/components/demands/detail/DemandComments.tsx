import { useState } from "react";
import { useDemandComments, useAddDemandComment } from "@/hooks/useDemandComments";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Send, Lock, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function DemandComments({ demandId }: { demandId: string }) {
  const { user } = useAuth();
  const { isManager } = useUserRole();
  const { data: comments = [], isLoading } = useDemandComments(demandId);
  const add = useAddDemandComment();

  const [text, setText] = useState("");
  const [internalMode, setInternalMode] = useState(false);

  const submit = async () => {
    if (text.trim().length < 1) return;
    try {
      await add.mutateAsync({
        demandId,
        comment: text,
        visibility: isManager && internalMode ? "internal" : "client",
      });
      setText("");
      toast.success("Comentário enviado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Conversa ({comments.length})</h3>
        {isManager && (
          <button
            type="button"
            onClick={() => setInternalMode((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors",
              internalMode
                ? "bg-amber-100 text-amber-700 border-amber-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            )}
          >
            {internalMode ? <Lock className="w-3 h-3" /> : <Users className="w-3 h-3" />}
            {internalMode ? "Só equipe" : "Visível ao cliente"}
          </button>
        )}
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-6">Carregando…</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">Nenhum comentário ainda.</p>
        ) : (
          comments.map((c) => {
            const mine = c.user_id === user?.id;
            return (
              <div key={c.id} className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm border",
                    mine
                      ? "bg-primary text-primary-foreground border-primary/30"
                      : "bg-white/70 border-black/[0.06]"
                  )}
                >
                  {c.visibility === "internal" && (
                    <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] mb-1">
                      Interno
                    </Badge>
                  )}
                  <div className="whitespace-pre-wrap">{c.comment}</div>
                  <div className={cn("text-[10px] mt-1", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-2">
        <Textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isManager && internalMode ? "Anotação interna (cliente não vê)..." : "Escreva uma mensagem..."}
        />
        <div className="flex justify-end">
          <Button onClick={submit} disabled={add.isPending || !text.trim()} className="gap-2">
            {add.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
