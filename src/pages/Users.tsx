import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fetchUsers, createUser, updateUser, resetUserPassword, deleteUser, fetchPsychologists } from "@/lib/api";
import { Plus, Trash2, Edit, Key, Loader2, Shield, UserCog } from "lucide-react";
import { toast } from "sonner";
import { User, Psychologist } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ email: "", password: "", name: "", role: "psychologist" as "admin" | "psychologist", psychologistId: "" });
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "psychologist" as "admin" | "psychologist", psychologistId: "" });
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    Promise.all([fetchUsers(), fetchPsychologists()])
      .then(([u, p]) => { setUsers(u); setPsychologists(p); })
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!form.email || !form.password || !form.name) { toast.error("Preencha todos os campos"); return; }
    setSaving(true);
    try {
      await createUser({
        email: form.email, password: form.password, name: form.name,
        role: form.role, psychologistId: form.psychologistId || undefined,
      });
      setUsers(await fetchUsers());
      setDialogOpen(false);
      setForm({ email: "", password: "", name: "", role: "psychologist", psychologistId: "" });
      toast.success("Usuário criado");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  function openEdit(u: User) {
    setSelectedUser(u);
    setEditForm({ name: u.name, email: u.email, role: u.role, psychologistId: u.psychologistId || "" });
    setEditDialogOpen(true);
  }

  async function handleEdit() {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await updateUser(selectedUser.id, {
        name: editForm.name, email: editForm.email,
        role: editForm.role, psychologistId: editForm.psychologistId || undefined,
      });
      setUsers(await fetchUsers());
      setEditDialogOpen(false);
      toast.success("Usuário atualizado");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  function openPassword(u: User) {
    setSelectedUser(u);
    setNewPassword("");
    setPasswordDialogOpen(true);
  }

  async function handleResetPassword() {
    if (!selectedUser || !newPassword) { toast.error("Digite a nova senha"); return; }
    setSaving(true);
    try {
      await resetUserPassword(selectedUser.id, newPassword);
      setPasswordDialogOpen(false);
      toast.success("Senha atualizada");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (id === currentUser?.id) { toast.error("Não pode deletar a si mesmo"); return; }
    try {
      await deleteUser(id);
      setUsers(await fetchUsers());
      toast.success("Usuário removido");
    } catch (err: any) { toast.error(err.message); }
  }

  const getPsyName = (id?: string) => id ? psychologists.find(p => p.id === id)?.name || "—" : "—";

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Usuários</h1>
          <p className="text-muted-foreground">Criar e gerenciar acessos ao sistema</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Novo Usuário</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Usuário</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              <div><Label>Senha *</Label><Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
              <div>
                <Label>Perfil</Label>
                <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="psychologist">Psicólogo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.role === "psychologist" && (
                <div>
                  <Label>Vincular ao Psicólogo</Label>
                  <Select value={form.psychologistId} onValueChange={v => setForm(f => ({ ...f, psychologistId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{psychologists.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">O psicólogo verá apenas seus pacientes e sessões</p>
                </div>
              )}
              <Button onClick={handleCreate} className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar Usuário
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div>
              <Label>Perfil</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="psychologist">Psicólogo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editForm.role === "psychologist" && (
              <div>
                <Label>Vincular ao Psicólogo</Label>
                <Select value={editForm.psychologistId} onValueChange={v => setEditForm(f => ({ ...f, psychologistId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{psychologists.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleEdit} className="w-full" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar Senha</DialogTitle></DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Usuário: <strong>{selectedUser.name}</strong> ({selectedUser.email})</p>
              <div><Label>Nova Senha</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 4 caracteres" /></div>
              <Button onClick={handleResetPassword} className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Alterar Senha
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Perfil</TableHead>
                <TableHead>Psicólogo Vinculado</TableHead><TableHead className="w-[140px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "admin" ? "default" : "secondary"} className="gap-1">
                      {u.role === "admin" ? <Shield className="h-3 w-3" /> : <UserCog className="h-3 w-3" />}
                      {u.role === "admin" ? "Admin" : "Psicólogo"}
                    </Badge>
                  </TableCell>
                  <TableCell>{getPsyName(u.psychologistId)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Editar"><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => openPassword(u)} title="Alterar senha"><Key className="h-4 w-4" /></Button>
                      {u.id !== currentUser?.id && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)} title="Remover"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
