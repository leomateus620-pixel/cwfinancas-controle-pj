import { useState, useMemo } from "react";
import { FileCheck, Search, Filter, Calendar, Calculator, Clock, CheckCircle, AlertCircle, Plus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CorporateCard } from "@/components/corporate/CorporateCard";
import { InvoiceModal } from "@/components/modals/InvoiceModal";
import { useInvoices, Invoice } from "@/hooks/useInvoices";
import { InvoiceFormData } from "@/lib/validators";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "paid":
      return <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20">Pago</Badge>;
    case "pending":
      return <Badge className="bg-warning/10 text-warning border-warning/20 hover:bg-warning/20">Pendente</Badge>;
    case "overdue":
      return <Badge className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/20">Vencido</Badge>;
    default:
      return null;
  }
};

export function InvoicesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  const { invoices, isLoading, summary, createInvoice, updateInvoice } = useInvoices();

  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => 
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.client_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [invoices, searchTerm]);

  // Calculate estimated taxes (simplified)
  const taxSummary = useMemo(() => {
    const baseValue = summary.totalValue;
    return {
      icms: Math.round(baseValue * 0.18),
      pis: Math.round(baseValue * 0.0165),
      cofins: Math.round(baseValue * 0.076),
      iss: Math.round(baseValue * 0.05),
      irpj: Math.round(baseValue * 0.15),
      csll: Math.round(baseValue * 0.09),
    };
  }, [summary.totalValue]);

  const totalTax = Object.values(taxSummary).reduce((acc, val) => acc + val, 0);

  const handleSubmit = async (data: InvoiceFormData) => {
    if (editingInvoice) {
      await updateInvoice.mutateAsync({ 
        id: editingInvoice.id,
        invoice_number: data.invoice_number,
        client_name: data.client_name,
        value: data.value,
        issue_date: data.issue_date,
        due_date: data.due_date,
        status: data.status,
      });
    } else {
      await createInvoice.mutateAsync({
        invoice_number: data.invoice_number,
        client_name: data.client_name,
        value: data.value,
        issue_date: data.issue_date,
        due_date: data.due_date,
        status: data.status,
      });
    }
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setModalOpen(true);
  };

  const handleNewInvoice = () => {
    setEditingInvoice(null);
    setModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <FileCheck className="w-8 h-8 text-primary" />
            Notas Fiscais
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestão de notas fiscais e impostos.
          </p>
        </div>
        <Button className="gap-2 rounded-xl bg-primary hover:bg-primary/90 self-start" onClick={handleNewInvoice}>
          <Plus className="w-4 h-4" />
          <span>Nova Nota Fiscal</span>
        </Button>
      </div>

      {/* KPIs de NFs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 stagger-children">
        <CorporateCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileCheck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total de NFs</p>
              <p className="text-xl font-bold text-foreground">{summary.total}</p>
            </div>
          </div>
        </CorporateCard>

        <CorporateCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pagas</p>
              <p className="text-xl font-bold text-success">{summary.paid}</p>
            </div>
          </div>
        </CorporateCard>

        <CorporateCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-xl font-bold text-warning">{summary.pending}</p>
            </div>
          </div>
        </CorporateCard>

        <CorporateCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertCircle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vencidas</p>
              <p className="text-xl font-bold text-destructive">{summary.overdue}</p>
            </div>
          </div>
        </CorporateCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Notas Fiscais */}
        <Card className="lg:col-span-2 bg-card/95 backdrop-blur-md border-border shadow-corporate-md rounded-2xl">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">Notas Fiscais Emitidas</CardTitle>
                <CardDescription className="text-muted-foreground">Gestão de documentos fiscais</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar NF..." 
                    className="pl-9 w-48 rounded-xl border-border"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon" className="rounded-xl border-border">
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((invoice) => (
                  <div 
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-accent/50 transition-corporate cursor-pointer"
                    onClick={() => handleEdit(invoice)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <FileCheck className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{invoice.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{invoice.client_name}</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <p className="text-sm font-bold text-foreground">{formatCurrency(Number(invoice.value))}</p>
                        <p className="text-xs text-muted-foreground">Venc: {formatDate(invoice.due_date)}</p>
                      </div>
                      {getStatusBadge(invoice.status)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {invoices.length === 0 
                    ? "Nenhuma nota fiscal cadastrada. Clique em 'Nova Nota Fiscal' para começar."
                    : "Nenhum resultado encontrado para a busca."}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resumo de Impostos */}
        <Card className="bg-card/95 backdrop-blur-md border-border shadow-corporate-md rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Calculator className="w-5 h-5 text-warning" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-foreground">Impostos</CardTitle>
                <CardDescription className="text-muted-foreground">Resumo de tributos estimados</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {Object.entries(taxSummary).map(([tax, value]) => (
                <div key={tax} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-accent/30 transition-corporate">
                  <span className="text-sm text-muted-foreground uppercase">{tax}</span>
                  <span className="text-sm font-medium text-foreground">{formatCurrency(value)}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                <span className="text-sm font-semibold text-foreground">Total Estimado</span>
                <span className="text-lg font-bold text-warning">{formatCurrency(totalTax)}</span>
              </div>
            </div>

            <Button className="w-full gap-2 rounded-xl bg-primary hover:bg-primary/90">
              <Calendar className="w-4 h-4" />
              <span>Gerar Guias</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      <InvoiceModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleSubmit}
        invoice={editingInvoice}
      />
    </div>
  );
}

export default InvoicesPage;
