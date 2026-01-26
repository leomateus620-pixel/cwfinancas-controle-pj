import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email({ message: "E-mail inválido" }),
  password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),
});

export const registerSchema = z.object({
  full_name: z.string().trim().min(2, { message: "Nome deve ter no mínimo 2 caracteres" }).max(100),
  company_name: z.string().trim().min(2, { message: "Nome da empresa deve ter no mínimo 2 caracteres" }).max(100),
  email: z.string().trim().email({ message: "E-mail inválido" }),
  password: z.string().min(6, { message: "Senha deve ter no mínimo 6 caracteres" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não conferem",
  path: ["confirmPassword"],
});

export const transactionSchema = z.object({
  type: z.enum(["income", "expense"], { required_error: "Selecione o tipo" }),
  description: z.string().trim().min(3, { message: "Descrição deve ter no mínimo 3 caracteres" }).max(200),
  amount: z.number().positive({ message: "Valor deve ser positivo" }),
  category: z.string().trim().min(1, { message: "Selecione uma categoria" }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida" }),
  client_vendor: z.string().optional(),
  notes: z.string().optional(),
});

export const invoiceSchema = z.object({
  invoice_number: z.string().trim().min(1, { message: "Número da NF é obrigatório" }),
  client_name: z.string().trim().min(2, { message: "Nome do cliente é obrigatório" }),
  value: z.number().positive({ message: "Valor deve ser positivo" }),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data de emissão inválida" }),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data de vencimento inválida" }),
  status: z.enum(["paid", "pending", "overdue"]),
});

export const balanceItemSchema = z.object({
  type: z.enum(["asset", "liability", "equity"], { required_error: "Selecione o tipo" }),
  category: z.string().trim().min(1, { message: "Categoria é obrigatória" }),
  name: z.string().trim().min(2, { message: "Nome é obrigatório" }),
  amount: z.number().positive({ message: "Valor deve ser positivo" }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data inválida" }),
});

export const profileSchema = z.object({
  full_name: z.string().trim().min(2, { message: "Nome deve ter no mínimo 2 caracteres" }).max(100),
  company_name: z.string().trim().min(2, { message: "Nome da empresa deve ter no mínimo 2 caracteres" }).max(100),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type TransactionFormData = z.infer<typeof transactionSchema>;
export type InvoiceFormData = z.infer<typeof invoiceSchema>;
export type BalanceItemFormData = z.infer<typeof balanceItemSchema>;
export type ProfileFormData = z.infer<typeof profileSchema>;
