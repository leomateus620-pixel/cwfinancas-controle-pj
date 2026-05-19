import { useState } from "react";
import { useCategoryRules, useUpsertCategoryRule, useDeleteCategoryRule, type CategoryRule } from "@/hooks/useCategoryRules";
import { useUserRole } from "@/hooks/useUserRole";
import { GlassCard } from "@/components/home/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, ShieldAlert, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function DemandsSettingsPage() {
  const { isManager, isLoading: roleLoading } = useUserRole();
  const { data: rules = [], isLoading, error } = useCategoryRules();
  const upsert = useUpsertCategoryRule();
  const del = useDeleteCategoryRule();

  const [editing, setEditing] = useState<CategoryRule | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ keyword: "", category: "", priority: 50, is_active: true });

  if (!roleLoading && !isManager) {
    return (
      <div className="p-12 text-center max-w-xl mx-auto">
        <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm font-medium">Acesso restrito</p>
      </div>
    );
  }

  const openNew = () => { setEditing(null); setForm({ keyword: "", category: "", priority: 50, is_active: true }); setOpen(true); };
  const openEdit = (r: CategoryRule) => { setEditing(r); setForm({ keyword: r.keyword, category: r.category, priority: r.priority, is_active: r.is_active }); setOpen(true); };

  const save = async () => {
    if (!form.keyword.trim() || !form.category.trim()) {
      toast.error("Preencha palavra-chave e categoria");
      return;
    }
    try {
      await upsert.mutateAsync({ id: editing?.id, ...form });
      toast.success("Regra salva");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  const toggleActive = async (r: CategoryRule, next: boolean) => {
    try {
      await upsert.mutateAsync({ id: r.id, keyword: r.keyword, category: r.category, priority: r.priority, is_active: next });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Regras & categorias</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Palavras-chave detectadas no título, descrição ou fornecedor sugerem uma categoria automaticamente.
          </p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nova regra</Button>
      </div>

      <GlassCard className="p-4 bg-violet-50/40 border-violet-200/60">
        <div className="flex items-start gap-3 text-sm">
          <Sparkles className="w-4 h-4 text-violet-600 mt-0.5" />
          <div>
            <div className="font-medium text-violet-800">Como funciona</div>
            <p className="text-violet-800/80 mt-1">
              Quando uma demanda é criada, buscamos a primeira regra ativa cuja palavra-chave aparece no texto, ordenada por prioridade.
              A categoria sugerida pode ser confirmada pela equipe na tela da demanda.
            </p>
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : error ? (
          <div className="p-10 text-center"><AlertCircle className="w-8 h-8 mx-auto text-destructive mb-2" /><p className="text-sm">Falha ao carregar.</p></div>
        ) : rules.length === 0 ? (
          <div className="p-16 text-center">
            <Sparkles className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm">Nenhuma regra cadastrada. Crie a primeira.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-white/40 border-b border-black/[0.04]">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Palavra-chave</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3 text-center">Prioridade</th>
                <th className="px-4 py-3 text-center">Ativa</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b border-black/[0.03] hover:bg-white/40">
                  <td className="px-4 py-3 font-mono text-xs">{r.keyword}</td>
                  <td className="px-4 py-3 font-medium">{r.category}</td>
                  <td className="px-4 py-3 text-center text-xs">{r.priority}</td>
                  <td className="px-4 py-3 text-center"><Switch checked={r.is_active} onCheckedChange={(v) => toggleActive(r, v)} /></td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                      if (confirm(`Excluir regra "${r.keyword}"?`)) del.mutate(r.id, { onSuccess: () => toast.success("Regra removida") });
                    }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </GlassCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar regra" : "Nova regra"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Palavra-chave</Label>
              <Input value={form.keyword} onChange={(e) => setForm((f) => ({ ...f, keyword: e.target.value }))} placeholder="ex: aluguel" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="ex: Aluguel" />
            </div>
            <div>
              <Label>Prioridade (0-100)</Label>
              <Input type="number" min={0} max={100} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))} />
              <p className="text-[11px] text-muted-foreground mt-1">Maior prioridade vence em conflitos.</p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Ativa</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={upsert.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
