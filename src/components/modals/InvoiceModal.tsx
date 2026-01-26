import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { invoiceSchema, InvoiceFormData } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Invoice } from "@/hooks/useInvoices";

interface InvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InvoiceFormData) => Promise<void>;
  invoice?: Invoice | null;
}

export function InvoiceModal({
  open,
  onOpenChange,
  onSubmit,
  invoice,
}: InvoiceModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!invoice;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoice_number: "",
      client_name: "",
      value: 0,
      issue_date: new Date().toISOString().split("T")[0],
      due_date: new Date().toISOString().split("T")[0],
      status: "pending",
    },
  });

  useEffect(() => {
    if (invoice) {
      setValue("invoice_number", invoice.invoice_number);
      setValue("client_name", invoice.client_name);
      setValue("value", Number(invoice.value));
      setValue("issue_date", invoice.issue_date);
      setValue("due_date", invoice.due_date);
      setValue("status", invoice.status);
    } else {
      reset({
        invoice_number: "",
        client_name: "",
        value: 0,
        issue_date: new Date().toISOString().split("T")[0],
        due_date: new Date().toISOString().split("T")[0],
        status: "pending",
      });
    }
  }, [invoice, setValue, reset]);

  const handleFormSubmit = async (data: InvoiceFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit(data);
      onOpenChange(false);
      reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Nota Fiscal" : "Nova Nota Fiscal"}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados da nota fiscal abaixo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_number">Número da NF</Label>
              <Input
                id="invoice_number"
                placeholder="NF-001234"
                {...register("invoice_number")}
                className={errors.invoice_number ? "border-destructive" : ""}
              />
              {errors.invoice_number && (
                <p className="text-sm text-destructive">{errors.invoice_number.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(v) => setValue("status", v as "paid" | "pending" | "overdue")}
              >
                <SelectTrigger className={errors.status ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-sm text-destructive">{errors.status.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_name">Nome do Cliente</Label>
            <Input
              id="client_name"
              placeholder="Nome do cliente ou empresa"
              {...register("client_name")}
              className={errors.client_name ? "border-destructive" : ""}
            />
            {errors.client_name && (
              <p className="text-sm text-destructive">{errors.client_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">Valor (R$)</Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              {...register("value", { valueAsNumber: true })}
              className={errors.value ? "border-destructive" : ""}
            />
            {errors.value && (
              <p className="text-sm text-destructive">{errors.value.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issue_date">Data de Emissão</Label>
              <Input
                id="issue_date"
                type="date"
                {...register("issue_date")}
                className={errors.issue_date ? "border-destructive" : ""}
              />
              {errors.issue_date && (
                <p className="text-sm text-destructive">{errors.issue_date.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Data de Vencimento</Label>
              <Input
                id="due_date"
                type="date"
                {...register("due_date")}
                className={errors.due_date ? "border-destructive" : ""}
              />
              {errors.due_date && (
                <p className="text-sm text-destructive">{errors.due_date.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? "Salvar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
