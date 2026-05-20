import { DEMAND_TYPES } from "@/lib/demands/types";
import type { DemandFormState } from "../SmartDemandForm";

function formatBRL(raw: string) {
  if (!raw) return "";
  return `R$ ${raw}`;
}

/**
 * Gera o texto dinâmico do card de agradecimento conforme o tipo da demanda.
 */
export function buildDemandSummary(form: DemandFormState): string {
  const valor = formatBRL(form.amount);
  const supplier = form.supplier_name?.trim();

  switch (form.demand_type) {
    case "pagamento":
      if (supplier && valor) {
        return `A equipe da CW irá analisar sua solicitação de pagamento para ${supplier} no valor de ${valor}.`;
      }
      if (supplier) {
        return `A equipe da CW irá analisar sua solicitação de pagamento para ${supplier}.`;
      }
      return "A equipe da CW irá analisar sua solicitação de pagamento e dará andamento o mais breve possível.";

    case "recebimento":
      if (supplier) {
        return `A equipe da CW irá analisar o registro de recebimento informado para ${supplier}.`;
      }
      return "A equipe da CW irá analisar o registro de recebimento informado.";

    case "nota_fiscal":
      if (supplier) {
        return `A equipe da CW irá analisar sua solicitação de emissão de nota fiscal para ${supplier}.`;
      }
      return "A equipe da CW irá analisar sua solicitação de emissão de nota fiscal.";

    case "boleto":
      if (supplier) {
        return `A equipe da CW irá analisar sua solicitação de emissão de cobrança para ${supplier}.`;
      }
      return "A equipe da CW irá analisar sua solicitação de emissão de cobrança.";

    case "conciliacao": {
      const conta = form.bank_account?.trim();
      const periodo = form.period?.trim();
      const ref = [conta, periodo].filter(Boolean).join(" • ");
      if (ref) {
        return `A equipe da CW irá analisar sua solicitação de conciliação bancária referente a ${ref}.`;
      }
      return "A equipe da CW irá analisar sua solicitação de conciliação bancária.";
    }

    case "reembolso":
      if (valor) {
        return `A equipe da CW irá analisar sua solicitação de reembolso no valor de ${valor}.`;
      }
      return "A equipe da CW irá analisar sua solicitação de reembolso.";

    default:
      return "A equipe da CW irá analisar sua solicitação e dará andamento o mais breve possível.";
  }
}

export function getTypeLabel(typeKey: string): string {
  return DEMAND_TYPES.find((t) => t.value === typeKey)?.label ?? "Demanda";
}
