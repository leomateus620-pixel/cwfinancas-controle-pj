import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { DemandPriority, DemandStatus } from "@/hooks/useFinancialDemands";

interface Props {
  search: string;
  status: DemandStatus | "all";
  priority: DemandPriority | "all";
  onSearch: (v: string) => void;
  onStatus: (v: DemandStatus | "all") => void;
  onPriority: (v: DemandPriority | "all") => void;
}

export function DemandFilters({ search, status, priority, onSearch, onStatus, onPriority }: Props) {
  return (
    <div className="flex flex-col md:flex-row gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Buscar por título..."
          className="pl-9 bg-white/60 backdrop-blur-sm border-white/40 rounded-xl h-10"
        />
      </div>
      <Select value={status} onValueChange={(v) => onStatus(v as DemandStatus | "all")}>
        <SelectTrigger className="w-full md:w-56 bg-white/60 backdrop-blur-sm border-white/40 rounded-xl h-10">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os status</SelectItem>
          <SelectItem value="recebida">Recebida</SelectItem>
          <SelectItem value="em_analise">Em análise</SelectItem>
          <SelectItem value="aguardando_info">Aguardando info</SelectItem>
          <SelectItem value="aguardando_aprovacao">Aguardando aprovação</SelectItem>
          <SelectItem value="aprovada">Aprovada</SelectItem>
          <SelectItem value="reprovada">Reprovada</SelectItem>
          <SelectItem value="em_execucao">Em execução</SelectItem>
          <SelectItem value="pagamento_agendado">Pagamento agendado</SelectItem>
          <SelectItem value="comprovante_enviado">Comprovante enviado</SelectItem>
          <SelectItem value="finalizada">Finalizada</SelectItem>
          <SelectItem value="cancelada">Cancelada</SelectItem>
        </SelectContent>
      </Select>
      <Select value={priority} onValueChange={(v) => onPriority(v as DemandPriority | "all")}>
        <SelectTrigger className="w-full md:w-44 bg-white/60 backdrop-blur-sm border-white/40 rounded-xl h-10">
          <SelectValue placeholder="Prioridade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas prioridades</SelectItem>
          <SelectItem value="baixa">Baixa</SelectItem>
          <SelectItem value="normal">Normal</SelectItem>
          <SelectItem value="alta">Alta</SelectItem>
          <SelectItem value="urgente">Urgente</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
