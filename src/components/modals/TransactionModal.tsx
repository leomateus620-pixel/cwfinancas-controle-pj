import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { transactionSchema, TransactionFormData } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { Transaction } from "@/hooks/useTransactions";

interface TransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  defaultType?: "income" | "expense";
  transaction?: Transaction | null;
}

const incomeCategories = [
  "Vendas de Produtos",
  "Serviços",
  "Assinaturas",
  "Consultoria",
  "Comissões",
  "Outros",
];

const expenseCategories = [
  "Salários",
  "Marketing",
  "Tecnologia",
  "Operações",
  "Serviços",
  "Impostos",
  "Transporte",
  "Outros",
];

export function TransactionModal({
  open,
  onOpenChange,
  onSubmit,
  defaultType = "income",
  transaction,
}: TransactionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!transaction;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: defaultType,
      description: "",
      amount: 0,
      category: "",
      date: new Date().toISOString().split("T")[0],
      client_vendor: "",
      notes: "",
    },
  });

  const selectedType = watch("type");
  const categories = selectedType === "income" ? incomeCategories : expenseCategories;

  useEffect(() => {
    if (transaction) {
      setValue("type", transaction.type);
      setValue("description", transaction.description);
      setValue("amount", Number(transaction.amount));
      setValue("category", transaction.category);
      setValue("date", transaction.date);
      setValue("client_vendor", transaction.client_vendor || "");
      setValue("notes", transaction.notes || "");
    } else {
      reset({
        type: defaultType,
        description: "",
        amount: 0,
        category: "",
        date: new Date().toISOString().split("T")[0],
        client_vendor: "",
        notes: "",
      });
    }
  }, [transaction, defaultType, setValue, reset]);

  const handleFormSubmit = async (data: TransactionFormData) => {
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
            {isEditing ? "Editar Transação" : `Nova ${defaultType === "income" ? "Receita" : "Despesa"}`}
          </DialogTitle>
          <DialogDescription>
            Preencha os dados da transação abaixo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={selectedType}
                onValueChange={(v) => setValue("type", v as "income" | "expense")}
              >
                <SelectTrigger className={errors.type ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && (
                <p className="text-sm text-destructive">{errors.type.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={watch("category")}
                onValueChange={(v) => setValue("category", v)}
              >
                <SelectTrigger className={errors.category ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              placeholder="Ex: Venda de software"
              {...register("description")}
              className={errors.description ? "border-destructive" : ""}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                {...register("amount", { valueAsNumber: true })}
                className={errors.amount ? "border-destructive" : ""}
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Data</Label>
              <Input
                id="date"
                type="date"
                {...register("date")}
                className={errors.date ? "border-destructive" : ""}
              />
              {errors.date && (
                <p className="text-sm text-destructive">{errors.date.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client_vendor">
              {selectedType === "income" ? "Cliente" : "Fornecedor"} (opcional)
            </Label>
            <Input
              id="client_vendor"
              placeholder={selectedType === "income" ? "Nome do cliente" : "Nome do fornecedor"}
              {...register("client_vendor")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Adicione notas ou detalhes..."
              {...register("notes")}
              rows={3}
            />
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
