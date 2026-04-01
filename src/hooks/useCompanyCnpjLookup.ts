import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface CnpjLookupResult {
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string | null;
  situacao_cadastral: string | null;
  natureza_juridica: string | null;
  data_abertura: string | null;
  ano_fundacao: number | null;
  cnae_principal: string | null;
  cnaes_secundarios: string[] | null;
  porte: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  setor: string | null;
  regime_tributario: string | null;
  quadro_societario: any[] | null;
  source: string;
}

function validateCNPJ(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calc = (slice: string, weights: number[]): number => {
    const sum = slice.split("").reduce((s, d, i) => s + Number(d) * weights[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(digits.slice(0, 12), w1);
  if (Number(digits[12]) !== d1) return false;
  const d2 = calc(digits.slice(0, 13), w2);
  return Number(digits[13]) === d2;
}

export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function useCompanyCnpjLookup() {
  const [preview, setPreview] = useState<CnpjLookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const isValid = useCallback((cnpj: string) => {
    return validateCNPJ(cnpj);
  }, []);

  const lookup = useCallback(async (cnpj: string) => {
    const digits = cnpj.replace(/\D/g, "");
    if (!validateCNPJ(digits)) {
      setError("CNPJ inválido — verifique os dígitos");
      return;
    }

    setIsLoading(true);
    setError(null);
    setPreview(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("cnpj-lookup", {
        body: { cnpj: digits },
      });

      if (fnError) throw fnError;
      if (data?.error) {
        setError(data.error);
        toast({ variant: "destructive", title: "CNPJ não encontrado", description: data.error });
        return;
      }

      setPreview(data as CnpjLookupResult);
    } catch (e: any) {
      setError("Erro ao consultar CNPJ");
      toast({ variant: "destructive", title: "Erro na consulta", description: e.message || "Tente novamente." });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const clearPreview = useCallback(() => {
    setPreview(null);
    setError(null);
  }, []);

  return { preview, isLoading, error, isValid, lookup, clearPreview };
}
