import { FileCheck, Search, Filter, Calendar, Calculator, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CorporateCard } from "@/components/corporate/CorporateCard";
import { cn } from "@/lib/utils";

// Dados de exemplo - Notas Fiscais
const invoices = [
  { id: "NF-001234", client: "Empresa ABC Ltda", value: 45000, issueDate: "2024-01-15", dueDate: "2024-02-15", status: "paid" },
  { id: "NF-001235", client: "Tech Solutions S.A.", value: 28500, issueDate: "2024-01-18", dueDate: "2024-02-18", status: "pending" },
  { id: "NF-001236", client: "Global Corp", value: 89000, issueDate: "2024-01-20", dueDate: "2024-01-25", status: "overdue" },
  { id: "NF-001237", client: "Startup XYZ", value: 15200, issueDate: "2024-01-22", dueDate: "2024-02-22", status: "paid" },
  { id: "NF-001238", client: "Indústria Nacional", value: 67800, issueDate: "2024-01-24", dueDate: "2024-02-24", status: "pending" },
  { id: "NF-001239", client: "Serviços Prime", value: 32400, issueDate: "2024-01-26", dueDate: "2024-02-26", status: "pending" },
];

const taxSummary = {
  icms: 42500,
  pis: 8900,
  cofins: 18200,
  iss: 12800,
  irpj: 28000,
  csll: 9500,
};

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

const totalTax = Object.values(taxSummary).reduce((acc, val) => acc + val, 0);

export function InvoicesPage() {
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
        <Button className="gap-2 rounded-xl bg-primary hover:bg-primary/90 self-start">
          <FileCheck className="w-4 h-4" />
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
              <p className="text-xl font-bold text-foreground">{invoices.length}</p>
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
              <p className="text-xl font-bold text-success">
                {invoices.filter(i => i.status === "paid").length}
              </p>
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
              <p className="text-xl font-bold text-warning">
                {invoices.filter(i => i.status === "pending").length}
              </p>
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
              <p className="text-xl font-bold text-destructive">
                {invoices.filter(i => i.status === "overdue").length}
              </p>
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
              {invoices.map((invoice) => (
                <div 
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-accent/50 transition-corporate"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <FileCheck className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{invoice.id}</p>
                      <p className="text-xs text-muted-foreground">{invoice.client}</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <p className="text-sm font-bold text-foreground">{formatCurrency(invoice.value)}</p>
                      <p className="text-xs text-muted-foreground">Venc: {formatDate(invoice.dueDate)}</p>
                    </div>
                    {getStatusBadge(invoice.status)}
                  </div>
                </div>
              ))}
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
                <CardDescription className="text-muted-foreground">Resumo de tributos</CardDescription>
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
                <span className="text-sm font-semibold text-foreground">Total a Pagar</span>
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
    </div>
  );
}

export default InvoicesPage;
