import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ExternalLink, Plus, LayoutGrid } from "lucide-react";

interface Props {
  demandId: string;
  onNew: () => void;
}

export function SuccessActionButtons({ demandId, onNew }: Props) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full">
      <Button asChild className="gap-2 shadow-[0_8px_22px_-6px_rgba(59,130,246,0.55)] bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-500 hover:to-blue-700 w-full sm:w-auto">
        <Link to={`/demands/${demandId}`}>
          Acompanhar demanda <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </Button>
      <Button
        onClick={onNew}
        variant="outline"
        className="gap-2 bg-white/70 w-full sm:w-auto"
      >
        <Plus className="w-4 h-4" /> Criar nova demanda
      </Button>
      <Button
        variant="ghost"
        onClick={() => navigate("/demands")}
        className="gap-2 w-full sm:w-auto"
      >
        <LayoutGrid className="w-4 h-4" /> Voltar para a Central
      </Button>
    </div>
  );
}
