import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";
import { useSetDemandCategory } from "@/hooks/useApproveDemand";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

export function CategorySuggestionBadge({
  demandId, suggested, finalCategory,
}: { demandId: string; suggested: string | null; finalCategory: string | null }) {
  const { isManager } = useUserRole();
  const setCategory = useSetDemandCategory();

  if (finalCategory) {
    return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{finalCategory}</Badge>;
  }
  if (!suggested) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="inline-flex items-center gap-2">
      <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 gap-1">
        <Sparkles className="w-3 h-3" /> Sugestão: {suggested}
      </Badge>
      {isManager && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 gap-1 text-xs"
          onClick={() => setCategory.mutate({ id: demandId, category: suggested }, {
            onSuccess: () => toast.success("Categoria confirmada"),
            onError: (e) => toast.error(e instanceof Error ? e.message : "Falha"),
          })}
        >
          <Check className="w-3 h-3" /> Confirmar
        </Button>
      )}
    </div>
  );
}
