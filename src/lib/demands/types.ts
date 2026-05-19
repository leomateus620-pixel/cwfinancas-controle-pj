export const DEMAND_TYPES = [
  { value: "pagamento", label: "Solicitar pagamento", icon: "CreditCard" },
  { value: "recebimento", label: "Registrar recebimento", icon: "ArrowDownToLine" },
  { value: "nota_fiscal", label: "Emitir nota fiscal", icon: "FileText" },
  { value: "boleto", label: "Boleto / cobrança", icon: "Receipt" },
  { value: "conciliacao", label: "Conciliação bancária", icon: "GitMerge" },
  { value: "reembolso", label: "Reembolso", icon: "Undo2" },
  { value: "outro", label: "Outro", icon: "MoreHorizontal" },
] as const;

export type DemandTypeValue = (typeof DEMAND_TYPES)[number]["value"];

export const PRIORITY_OPTIONS = [
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
] as const;
