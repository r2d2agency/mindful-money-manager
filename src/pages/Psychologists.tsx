import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPsychologists, savePsychologist, updatePsychologist, deletePsychologist, getSessions } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Psychologist } from "@/types";

export default function Psychologists() {
  const [list, setList] = useState(getPsychologists);
  const sessions = getSessions();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Psychologist | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", specialty: "", sessionRate: "" });

  function openNew() {
    setEditing(null);
    setForm({ name: "", email: "", phone: "", specialty: "", sessionRate: "" });
    setDialogOpen(true);
  }

  function openEdit(p: Psychologist) {
    setEditing(p);
    setForm({ name: p.name, email: p.email, phone: p.phone, specialty: p.specialty, sessionRate: String(p.sessionRate) });
    setDialogOpen(true);
  }

  function handleSave() {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    const data = { ...form, sessionRate: parseFloat(form.sessionRate) || 0 };
    if (editing) {
      updatePsychologist(editing.id, data);
      toast.success("Psicólogo atualizado");
    } else {
      savePsychologist(data);
      toast.success("Psicólogo cadastrado");
    }
    setList(getPsychologists());
    setDialogOpen(false);
  }

  function handleDelete(id: string) {
    deletePsychologist(id);
    setList(getPsychologists());
    toast.success("Psicólogo removido");
  }

  const getRevenue = (id: string) =>
    sessions.filter(s => s.psychologistId === id && s.paymentStatus === "paid").reduce((sum, s) => sum + s.paidAmount, 0);

  const getSessionCount = (id: string) =>
    sessions.filter(s => s.psychologistId === id).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Psicólogos</h1>
          <p className="text-muted-foreground">Equipe da clínica</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Psicólogo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar" : "Novo"} Psicólogo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Especialidade</Label>
                  <Input value={form.specialty} onChange={e => setForm(f => ({ ...f, specialty: e.target.value }))} />
                </div>
                <div>
                  <Label>Valor/Sessão</Label>
                  <Input type="number" value={form.sessionRate} onChange={e => setForm(f => ({ ...f, sessionRate: e.target.value }))} />
                </div>
              </div>
              <Button onClick={handleSave} className="w-full">{editing ? "Salvar" : "Cadastrar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Especialidade</TableHead>
                <TableHead>Valor/Sessão</TableHead>
                <TableHead>Sessões</TableHead>
                <TableHead>Receita</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum psicólogo cadastrado
                  </TableCell>
                </TableRow>
              ) : list.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.specialty || "—"}</TableCell>
                  <TableCell>{formatCurrency(p.sessionRate)}</TableCell>
                  <TableCell>{getSessionCount(p.id)}</TableCell>
                  <TableCell className="text-success font-medium">{formatCurrency(getRevenue(p.id))}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
