import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fetchSessions, createSession, updateSession, deleteSession, fetchPatients, fetchPsychologists } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { Plus, Trash2, CheckCircle, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Session, Patient, Psychologist } from "@/types";

const statusLabels: Record<string, string> = { scheduled: "Agendada", completed: "Realizada", cancelled: "Cancelada" };
const paymentLabels: Record<string, string> = { pending: "Pendente", paid: "Pago", partial: "Parcial" };

export default function Sessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ patientId: "", psychologistId: "", date: "", expectedAmount: "", isRecurring: false, notes: "" });

  useEffect(() => {
    Promise.all([fetchSessions(), fetchPatients(), fetchPsychologists()])
      .then(([s, p, psy]) => { setSessions(s); setPatients(p); setPsychologists(psy); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = sessions.filter(s => {
    const patient = patients.find(p => p.id === s.patientId);
    return patient?.name.toLowerCase().includes(search.toLowerCase()) || false;
  });

  async function handleSave() {
    if (!form.patientId || !form.date || !form.expectedAmount) { toast.error("Preencha os campos obrigatórios"); return; }
    setSaving(true);
    try {
      await createSession({
        patientId: form.patientId, psychologistId: form.psychologistId, date: form.date,
        status: "scheduled", paymentStatus: "pending", expectedAmount: parseFloat(form.expectedAmount),
        paidAmount: 0, isRecurring: form.isRecurring, notes: form.notes,
      });
      setSessions(await fetchSessions());
      setDialogOpen(false);
      setForm({ patientId: "", psychologistId: "", date: "", expectedAmount: "", isRecurring: false, notes: "" });
      toast.success("Sessão agendada");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  function openPayDialog(s: Session) { setSelectedSession(s); setPayAmount(String(s.expectedAmount)); setPayDialogOpen(true); }

  async function handlePay() {
    if (!selectedSession) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("Valor inválido"); return; }
    setSaving(true);
    try {
      const newPaid = selectedSession.paidAmount + amount;
      const paymentStatus = newPaid >= selectedSession.expectedAmount ? "paid" : "partial";
      await updateSession(selectedSession.id, { paidAmount: newPaid, paymentStatus, status: "completed" });
      setSessions(await fetchSessions());
      setPayDialogOpen(false);
      toast.success("Pagamento registrado");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    try { await deleteSession(id); setSessions(await fetchSessions()); toast.success("Sessão removida"); }
    catch (err: any) { toast.error(err.message); }
  }

  const getPatientName = (id: string) => patients.find(p => p.id === id)?.name || "—";
  const getPsyName = (id: string) => psychologists.find(p => p.id === id)?.name || "—";

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessões</h1>
          <p className="text-muted-foreground">Controle de sessões e pagamentos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Nova Sessão</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Agendar Sessão</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Paciente *</Label>
                <Select value={form.patientId} onValueChange={v => setForm(f => ({ ...f, patientId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{patients.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Psicólogo</Label>
                <Select value={form.psychologistId} onValueChange={v => setForm(f => ({ ...f, psychologistId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{psychologists.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Data *</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                <div><Label>Valor Previsto *</Label><Input type="number" value={form.expectedAmount} onChange={e => setForm(f => ({ ...f, expectedAmount: e.target.value }))} placeholder="0.00" /></div>
              </div>
              <div><Label>Observações</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <Button onClick={handleSave} className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Agendar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Pagamento</DialogTitle></DialogHeader>
          {selectedSession && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Paciente: <strong>{getPatientName(selectedSession.patientId)}</strong><br />
                Valor previsto: <strong>{formatCurrency(selectedSession.expectedAmount)}</strong><br />
                Já pago: <strong>{formatCurrency(selectedSession.paidAmount)}</strong>
              </p>
              <div>
                <Label>Valor do Pagamento</Label>
                <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="0.00" />
                <p className="text-xs text-muted-foreground mt-1">Pode informar valor diferente do previsto</p>
              </div>
              <Button onClick={handlePay} className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar Pagamento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por paciente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead><TableHead>Paciente</TableHead><TableHead>Psicólogo</TableHead>
                <TableHead>Status</TableHead><TableHead>Pagamento</TableHead><TableHead>Valor</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma sessão encontrada</TableCell></TableRow>
              ) : filtered.map(s => (
                <TableRow key={s.id}>
                  <TableCell>{formatDate(s.date)}</TableCell>
                  <TableCell className="font-medium">{getPatientName(s.patientId)}</TableCell>
                  <TableCell>{getPsyName(s.psychologistId)}</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "completed" ? "default" : s.status === "cancelled" ? "destructive" : "secondary"}>
                      {statusLabels[s.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.paymentStatus === "paid" ? "default" : s.paymentStatus === "partial" ? "outline" : "secondary"}
                      className={s.paymentStatus === "paid" ? "bg-success text-success-foreground" : ""}>
                      {paymentLabels[s.paymentStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell><div className="text-sm">{formatCurrency(s.paidAmount)} / {formatCurrency(s.expectedAmount)}</div></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {s.paymentStatus !== "paid" && (
                        <Button variant="ghost" size="icon" onClick={() => openPayDialog(s)} title="Baixar pagamento">
                          <CheckCircle className="h-4 w-4 text-success" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
