import { useState } from "react";
import { useClientUsers, useCreateClientUser, useResetClientPassword, useToggleClientUser } from "@/hooks/useClientUsers";
import { GlassCard } from "@/components/home/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Copy, KeyRound, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { slugifyUsername } from "@/lib/clientAuth";

function randomPassword(len = 10) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

export function ClientUsersSection() {
  const { data: users = [], isLoading } = useClientUsers();
  const create = useCreateClientUser();
  const reset = useResetClientPassword();
  const toggle = useToggleClientUser();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", display_name: "", password: randomPassword() });
  const [resetOpen, setResetOpen] = useState<{ id: string; username: string } | null>(null);
  const [newPwd, setNewPwd] = useState("");

  const openNew = () => {
    setForm({ username: "", display_name: "", password: randomPassword() });
    setOpen(true);
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copiado"),
      () => toast.error("Falha ao copiar"),
    );
  };

  const submit = async () => {
    const username = slugifyUsername(form.username);
    if (username.length < 3) return toast.error("Usuário deve ter ao menos 3 caracteres");
    if (form.password.length < 6) return toast.error("Senha deve ter ao menos 6 caracteres");
    try {
      await create.mutateAsync({ username, password: form.password, display_name: form.display_name || username });
      toast.success(`Acesso criado: ${username}`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao criar acesso");
    }
  };

  const submitReset = async () => {
    if (!resetOpen) return;
    if (newPwd.length < 6) return toast.error("Senha deve ter ao menos 6 caracteres");
    try {
      await reset.mutateAsync({ client_user_id: resetOpen.id, password: newPwd });
      toast.success("Senha redefinida");
      setResetOpen(null);
      setNewPwd("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    }
  };

  return (
    <GlassCard className="p-0 overflow-hidden">
      <div className="flex items-start justify-between gap-3 p-5 border-b border-black/[0.04]">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-600">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Acessos de cliente</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Crie um usuário simples (sem e-mail) para que seu cliente acesse apenas o envio de novas demandas.
            </p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Novo acesso</Button>
      </div>

      {isLoading ? (
        <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
      ) : users.length === 0 ? (
        <div className="p-10 text-center">
          <UserPlus className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum acesso de cliente criado ainda.</p>
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-white/40 border-b border-black/[0.04]">
            <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Usuário</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3 text-center">Ativo</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-black/[0.03] hover:bg-white/40">
                <td className="px-4 py-3 font-mono text-xs">{u.username}</td>
                <td className="px-4 py-3">{u.display_name ?? "—"}</td>
                <td className="px-4 py-3 text-center">
                  <Switch
                    checked={u.is_active}
                    onCheckedChange={(v) => toggle.mutate({ id: u.id, is_active: v })}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    onClick={() => { setResetOpen({ id: u.id, username: u.username }); setNewPwd(randomPassword()); }}
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Resetar senha
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* New access */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo acesso de cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Usuário</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="ex: joao.silva"
                autoCapitalize="none"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Será usado para login. Sem espaços, sem acento.
              </p>
            </div>
            <div>
              <Label>Nome de exibição</Label>
              <Input
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="Como o usuário aparecerá na interface"
              />
            </div>
            <div>
              <Label>Senha</Label>
              <div className="flex gap-2">
                <Input
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="font-mono"
                />
                <Button type="button" variant="outline" onClick={() => setForm((f) => ({ ...f, password: randomPassword() }))}>
                  Gerar
                </Button>
                <Button type="button" variant="outline" onClick={() => copy(form.password)} className="gap-1.5">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Anote ou copie a senha antes de fechar — ela não será exibida novamente.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={create.isPending}>Criar acesso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={!!resetOpen} onOpenChange={(v) => !v && setResetOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha — {resetOpen?.username}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nova senha</Label>
              <div className="flex gap-2">
                <Input value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="font-mono" />
                <Button type="button" variant="outline" onClick={() => setNewPwd(randomPassword())}>Gerar</Button>
                <Button type="button" variant="outline" onClick={() => copy(newPwd)} className="gap-1.5">
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(null)}>Cancelar</Button>
            <Button onClick={submitReset} disabled={reset.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </GlassCard>
  );
}
