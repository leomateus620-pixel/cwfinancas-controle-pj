import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIORITY_OPTIONS } from "@/lib/demands/types";
import { cn } from "@/lib/utils";

export interface DemandFormState {
  demand_type: string;
  title: string;
  priority: string;
  amount: string;
  due_date: string;
  supplier_name: string;
  supplier_document: string;
  cost_center: string;
  category: string;
  payment_method: string;
  bank_account: string;
  service_description: string;
  municipality: string;
  iss: string;
  charge_description: string;
  send_via: string;
  period: string;
  divergence_type: string;
  requester: string;
  refund_reason: string;
  refund_method: string;
  description: string;
}

export const EMPTY_FORM: DemandFormState = {
  demand_type: "",
  title: "",
  priority: "normal",
  amount: "",
  due_date: "",
  supplier_name: "",
  supplier_document: "",
  cost_center: "",
  category: "",
  payment_method: "",
  bank_account: "",
  service_description: "",
  municipality: "",
  iss: "",
  charge_description: "",
  send_via: "",
  period: "",
  divergence_type: "",
  requester: "",
  refund_reason: "",
  refund_method: "",
  description: "",
};

interface Props {
  form: DemandFormState;
  onChange: (k: keyof DemandFormState, v: string) => void;
}

// CNPJ/CPF mask
function maskDoc(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function maskBRL(v: string) {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "";
  const n = (parseInt(digits, 10) / 100).toFixed(2);
  return n.replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[12px] font-medium">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Group({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn(
      "rounded-2xl border border-black/[0.06] bg-white/55 backdrop-blur-xl p-4 md:p-5 shadow-[0_2px_8px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.6)]",
      className,
    )}>
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-3">{title}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
        {children}
      </div>
    </div>
  );
}

export function SmartDemandForm({ form, onChange }: Props) {
  const t = form.demand_type;
  const change = (k: keyof DemandFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange(k, e.target.value);

  // Common header (sempre): título + prioridade
  return (
    <div className="space-y-4">
      <Group title="Identificação">
        <Field label="Título" required>
          <Input value={form.title} onChange={change("title")} placeholder="Resumo curto da solicitação" className="bg-white/80" />
        </Field>
        <Field label="Prioridade" required>
          <Select value={form.priority} onValueChange={(v) => onChange("priority", v)}>
            <SelectTrigger className="bg-white/80"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </Group>

      {t === "pagamento" && (
        <Group title="Dados do pagamento">
          <Field label="Fornecedor" required>
            <Input value={form.supplier_name} onChange={change("supplier_name")} placeholder="Razão social ou nome" className="bg-white/80" />
          </Field>
          <Field label="CNPJ / CPF">
            <Input value={form.supplier_document} onChange={(e) => onChange("supplier_document", maskDoc(e.target.value))} placeholder="00.000.000/0000-00" className="bg-white/80" />
          </Field>
          <Field label="Valor (R$)" required>
            <Input inputMode="numeric" value={form.amount} onChange={(e) => onChange("amount", maskBRL(e.target.value))} placeholder="0,00" className="bg-white/80 font-mono tabular-nums" />
          </Field>
          <Field label="Vencimento" required>
            <Input type="date" value={form.due_date} onChange={change("due_date")} className="bg-white/80" />
          </Field>
          <Field label="Categoria">
            <Input value={form.category} onChange={change("category")} placeholder="Ex: Fornecedores, Aluguel" className="bg-white/80" />
          </Field>
          <Field label="Centro de custo">
            <Input value={form.cost_center} onChange={change("cost_center")} placeholder="Opcional" className="bg-white/80" />
          </Field>
          <Field label="Forma de pagamento">
            <Select value={form.payment_method} onValueChange={(v) => onChange("payment_method", v)}>
              <SelectTrigger className="bg-white/80"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="ted">TED / Transferência</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Conta de origem">
            <Input value={form.bank_account} onChange={change("bank_account")} placeholder="Conta a debitar" className="bg-white/80" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Observações">
              <Textarea rows={3} value={form.description} onChange={change("description")} placeholder="Contexto adicional, instruções, documento obrigatório..." className="bg-white/80" />
            </Field>
          </div>
        </Group>
      )}

      {t === "recebimento" && (
        <Group title="Dados do recebimento">
          <Field label="Cliente pagador" required>
            <Input value={form.supplier_name} onChange={change("supplier_name")} placeholder="Nome do pagador" className="bg-white/80" />
          </Field>
          <Field label="CNPJ / CPF">
            <Input value={form.supplier_document} onChange={(e) => onChange("supplier_document", maskDoc(e.target.value))} placeholder="00.000.000/0000-00" className="bg-white/80" />
          </Field>
          <Field label="Valor recebido (R$)" required>
            <Input inputMode="numeric" value={form.amount} onChange={(e) => onChange("amount", maskBRL(e.target.value))} placeholder="0,00" className="bg-white/80 font-mono tabular-nums" />
          </Field>
          <Field label="Data do recebimento" required>
            <Input type="date" value={form.due_date} onChange={change("due_date")} className="bg-white/80" />
          </Field>
          <Field label="Conta de destino">
            <Input value={form.bank_account} onChange={change("bank_account")} placeholder="Banco / conta" className="bg-white/80" />
          </Field>
          <Field label="Categoria">
            <Input value={form.category} onChange={change("category")} placeholder="Ex: Vendas, Serviços" className="bg-white/80" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Observações">
              <Textarea rows={3} value={form.description} onChange={change("description")} placeholder="Anexe o comprovante na próxima etapa." className="bg-white/80" />
            </Field>
          </div>
        </Group>
      )}

      {t === "nota_fiscal" && (
        <Group title="Dados da nota fiscal">
          <Field label="Tomador" required>
            <Input value={form.supplier_name} onChange={change("supplier_name")} placeholder="Empresa ou pessoa" className="bg-white/80" />
          </Field>
          <Field label="CNPJ / CPF">
            <Input value={form.supplier_document} onChange={(e) => onChange("supplier_document", maskDoc(e.target.value))} placeholder="00.000.000/0000-00" className="bg-white/80" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Serviço prestado" required>
              <Textarea rows={2} value={form.service_description} onChange={change("service_description")} placeholder="Descrição do serviço" className="bg-white/80" />
            </Field>
          </div>
          <Field label="Valor (R$)" required>
            <Input inputMode="numeric" value={form.amount} onChange={(e) => onChange("amount", maskBRL(e.target.value))} placeholder="0,00" className="bg-white/80 font-mono tabular-nums" />
          </Field>
          <Field label="Município">
            <Input value={form.municipality} onChange={change("municipality")} placeholder="Cidade da prestação" className="bg-white/80" />
          </Field>
          <Field label="Alíquota ISS (%)">
            <Input inputMode="decimal" value={form.iss} onChange={change("iss")} placeholder="Ex: 5" className="bg-white/80 font-mono tabular-nums" />
          </Field>
          <Field label="Prazo desejado">
            <Input type="date" value={form.due_date} onChange={change("due_date")} className="bg-white/80" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Dados adicionais">
              <Textarea rows={2} value={form.description} onChange={change("description")} placeholder="Informações extras para emissão" className="bg-white/80" />
            </Field>
          </div>
        </Group>
      )}

      {t === "boleto" && (
        <Group title="Dados do boleto / cobrança">
          <Field label="Cliente" required>
            <Input value={form.supplier_name} onChange={change("supplier_name")} placeholder="Nome do sacado" className="bg-white/80" />
          </Field>
          <Field label="CNPJ / CPF">
            <Input value={form.supplier_document} onChange={(e) => onChange("supplier_document", maskDoc(e.target.value))} placeholder="00.000.000/0000-00" className="bg-white/80" />
          </Field>
          <Field label="Valor (R$)" required>
            <Input inputMode="numeric" value={form.amount} onChange={(e) => onChange("amount", maskBRL(e.target.value))} placeholder="0,00" className="bg-white/80 font-mono tabular-nums" />
          </Field>
          <Field label="Vencimento" required>
            <Input type="date" value={form.due_date} onChange={change("due_date")} className="bg-white/80" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Descrição da cobrança">
              <Textarea rows={2} value={form.charge_description} onChange={change("charge_description")} placeholder="Referência da cobrança" className="bg-white/80" />
            </Field>
          </div>
          <Field label="Multa / juros (se aplicável)">
            <Input value={form.iss} onChange={change("iss")} placeholder="Ex: 2% + 1% a.m." className="bg-white/80" />
          </Field>
          <Field label="Enviar via">
            <Select value={form.send_via} onValueChange={(v) => onChange("send_via", v)}>
              <SelectTrigger className="bg-white/80"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email_whatsapp">E-mail + WhatsApp</SelectItem>
                <SelectItem value="nenhum">Não enviar</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Group>
      )}

      {t === "conciliacao" && (
        <Group title="Conciliação bancária">
          <Field label="Conta" required>
            <Input value={form.bank_account} onChange={change("bank_account")} placeholder="Banco / agência / conta" className="bg-white/80" />
          </Field>
          <Field label="Período" required>
            <Input value={form.period} onChange={change("period")} placeholder="Ex: 01/05 a 31/05" className="bg-white/80" />
          </Field>
          <Field label="Tipo de divergência">
            <Select value={form.divergence_type} onValueChange={(v) => onChange("divergence_type", v)}>
              <SelectTrigger className="bg-white/80"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrada_nao_identificada">Entrada não identificada</SelectItem>
                <SelectItem value="saida_nao_identificada">Saída não identificada</SelectItem>
                <SelectItem value="valor_divergente">Valor divergente</SelectItem>
                <SelectItem value="ausente">Lançamento ausente</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Observações">
              <Textarea rows={3} value={form.description} onChange={change("description")} placeholder="Detalhe a divergência. Anexe extrato na próxima etapa." className="bg-white/80" />
            </Field>
          </div>
        </Group>
      )}

      {t === "reembolso" && (
        <Group title="Dados do reembolso">
          <Field label="Solicitante" required>
            <Input value={form.requester} onChange={change("requester")} placeholder="Quem solicitou" className="bg-white/80" />
          </Field>
          <Field label="Valor (R$)" required>
            <Input inputMode="numeric" value={form.amount} onChange={(e) => onChange("amount", maskBRL(e.target.value))} placeholder="0,00" className="bg-white/80 font-mono tabular-nums" />
          </Field>
          <Field label="Data da despesa" required>
            <Input type="date" value={form.due_date} onChange={change("due_date")} className="bg-white/80" />
          </Field>
          <Field label="Forma de reembolso">
            <Select value={form.refund_method} onValueChange={(v) => onChange("refund_method", v)}>
              <SelectTrigger className="bg-white/80"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="ted">TED / Transferência</SelectItem>
                <SelectItem value="folha">Folha de pagamento</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Motivo / observações" required>
              <Textarea rows={3} value={form.refund_reason} onChange={change("refund_reason")} placeholder="Descreva a despesa e o motivo" className="bg-white/80" />
            </Field>
          </div>
        </Group>
      )}

      {t === "outro" && (
        <Group title="Detalhes">
          <div className="md:col-span-2">
            <Field label="Descrição" required>
              <Textarea rows={5} value={form.description} onChange={change("description")} placeholder="Descreva sua solicitação com o máximo de detalhes" className="bg-white/80" />
            </Field>
          </div>
        </Group>
      )}
    </div>
  );
}

/** Serializa o form para o payload do hook useCreateDemand */
export function buildDemandPayload(form: DemandFormState) {
  const parseAmount = (v: string): number | null => {
    if (!v) return null;
    const n = Number(v.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };
  // Description consolidada quando há campos específicos
  const extras: string[] = [];
  if (form.service_description) extras.push(`Serviço: ${form.service_description}`);
  if (form.charge_description) extras.push(`Cobrança: ${form.charge_description}`);
  if (form.refund_reason) extras.push(`Motivo: ${form.refund_reason}`);
  if (form.municipality) extras.push(`Município: ${form.municipality}`);
  if (form.iss) extras.push(`ISS / encargos: ${form.iss}`);
  if (form.payment_method) extras.push(`Forma de pagamento: ${form.payment_method}`);
  if (form.bank_account) extras.push(`Conta: ${form.bank_account}`);
  if (form.send_via) extras.push(`Envio: ${form.send_via}`);
  if (form.period) extras.push(`Período: ${form.period}`);
  if (form.divergence_type) extras.push(`Divergência: ${form.divergence_type}`);
  if (form.refund_method) extras.push(`Reembolso via: ${form.refund_method}`);
  if (form.requester) extras.push(`Solicitante: ${form.requester}`);

  const combinedDesc = [form.description, ...extras].filter(Boolean).join("\n");

  return {
    demand_type: form.demand_type,
    title: form.title.trim(),
    priority: form.priority,
    amount: parseAmount(form.amount),
    due_date: form.due_date || null,
    supplier_name: form.supplier_name.trim() || null,
    supplier_document: form.supplier_document.trim() || null,
    cost_center: form.cost_center.trim() || null,
    description: combinedDesc.trim() || null,
  };
}
