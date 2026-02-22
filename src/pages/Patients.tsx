import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchPatients, createPatient, updatePatient, deletePatient,
  fetchPsychologists, fetchSessions, fetchInvoices
} from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/format";
import { Plus, Pencil, Trash2, Search, Loader2, Eye, FileText, Calendar, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { Patient, Psychologist, Session, Invoice } from "@/types";

const statusLabels: Record<string, string> = { scheduled: "Agendada", completed: "Realizada", cancelled: "Cancelada" };
const paymentLabels: Record<string, string> = { pending: "Pendente", paid: "Pago", partial: "Parcial" };

export default function Patients() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", psychologistId: "", notes: "" });

  // Patient detail sheet
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  useEffect(() => {
    Promise.all([fetchPatients(), fetchPsychologists(), fetchSessions(), fetchInvoices()])
      .then(([p, psy, s, inv]) => { setPatients(p); setPsychologists(psy); setSessions(s); setInvoices(inv); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.email.toLowerCase().includes(search.toLowerCase())
  );

  // Data for selected patient
  const patientSessions = useMemo(() => {
    if (!selectedPatient) return [];
    return sessions.filter(s => s.patientId === selectedPatient.id).sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedPatient, sessions]);

  const patientInvoices = useMemo(() => {
    if (!selectedPatient) return [];
    return invoices.filter(inv => inv.patientId === selectedPatient.id).sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedPatient, invoices]);

  const patientStats = useMemo(() => {
    const total = patientSessions.filter(s => s.status !== "cancelled").length;
    const received = patientSessions.filter(s => s.paymentStatus === "paid").reduce((sum, s) => sum + s.paidAmount, 0);
    const pending = patientSessions.filter(s => s.paymentStatus !== "paid" && s.status !== "cancelled").reduce((sum, s) => sum + s.expectedAmount - s.paidAmount, 0);
    const invoiceTotal = patientInvoices.reduce((sum, inv) => sum + inv.amount, 0);
    return { total, received, pending, invoiceTotal, invoiceCount: patientInvoices.length };
  }, [patientSessions, patientInvoices]);

  function openNew() {
    setEditing(null);
    setForm({ name: "", email: "", phone: "", psychologistId: "", notes: "" });
    setDialogOpen(true);
  }

  function openEdit(p: Patient) {
    setEditing(p);
    setForm({ name: p.name, email: p.email, phone: p.phone, psychologistId: p.psychologistId, notes: p.notes });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    try {
      if (editing) {
        await updatePatient(editing.id, form);
        toast.success("Paciente atualizado");
      } else {
        await createPatient(form);
        toast.success("Paciente cadastrado");
      }
      setPatients(await fetchPatients());
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deletePatient(id);
      setPatients(await fetchPatients());
      toast.success("Paciente removido");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const getPsyName = (id: string) => psychologists.find(p => p.id === id)?.name || "—";

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-muted-foreground">Gerencie os pacientes da clínica</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo Paciente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar Paciente" : "Novo Paciente"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><Label>Telefone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div>
                <Label>Psicólogo</Label>
                <Select value={form.psychologistId} onValueChange={v => setForm(f => ({ ...f, psychologistId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{psychologists.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <Button onClick={handleSave} className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar paciente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Psicólogo</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="w-[130px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum paciente encontrado</TableCell></TableRow>
              ) : filtered.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.phone || "—"}</TableCell>
                  <TableCell>{getPsyName(p.psychologistId)}</TableCell>
                  <TableCell>{formatDate(p.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedPatient(p)} title="Ver ficha">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Patient Detail Sheet */}
      <Sheet open={!!selectedPatient} onOpenChange={(open) => !open && setSelectedPatient(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedPatient && (
            <>
              <SheetHeader>
                <SheetTitle className="text-xl">{selectedPatient.name}</SheetTitle>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  {selectedPatient.phone && <p>📱 {selectedPatient.phone}</p>}
                  {selectedPatient.email && <p>✉️ {selectedPatient.email}</p>}
                  <p>Psicólogo: {getPsyName(selectedPatient.psychologistId)}</p>
                  {selectedPatient.notes && <p className="italic mt-1">{selectedPatient.notes}</p>}
                </div>
              </SheetHeader>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mt-6">
                <Card>
                  <CardContent className="pt-4 pb-3 px-3 text-center">
                    <Calendar className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                    <div className="text-lg font-bold">{patientStats.total}</div>
                    <p className="text-xs text-muted-foreground">Sessões</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-3 text-center">
                    <DollarSign className="h-4 w-4 mx-auto text-success mb-1" />
                    <div className="text-lg font-bold text-success">{formatCurrency(patientStats.received)}</div>
                    <p className="text-xs text-muted-foreground">Recebido</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 pb-3 px-3 text-center">
                    <DollarSign className="h-4 w-4 mx-auto text-warning mb-1" />
                    <div className="text-lg font-bold text-warning">{formatCurrency(patientStats.pending)}</div>
                    <p className="text-xs text-muted-foreground">Pendente</p>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="sessions" className="mt-6">
                <TabsList className="w-full">
                  <TabsTrigger value="sessions" className="flex-1">
                    <Calendar className="mr-1 h-3 w-3" />Sessões ({patientSessions.length})
                  </TabsTrigger>
                  <TabsTrigger value="invoices" className="flex-1">
                    <FileText className="mr-1 h-3 w-3" />Notas ({patientInvoices.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="sessions" className="mt-3">
                  {patientSessions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-sm">Nenhuma sessão registrada</p>
                  ) : (
                    <div className="space-y-2">
                      {patientSessions.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border bg-card text-sm">
                          <div className="space-y-0.5">
                            <div className="font-medium">
                              {formatDate(s.date)}
                              {s.time && <span className="text-muted-foreground ml-2">{s.time}</span>}
                              {s.duration && <span className="text-muted-foreground ml-1">· {s.duration}min</span>}
                            </div>
                            <div className="flex gap-2">
                              <Badge variant={s.status === "completed" ? "default" : s.status === "cancelled" ? "destructive" : "secondary"} className="text-xs">
                                {statusLabels[s.status]}
                              </Badge>
                              <Badge
                                variant={s.paymentStatus === "paid" ? "default" : "outline"}
                                className={`text-xs ${s.paymentStatus === "paid" ? "bg-success text-success-foreground" : ""}`}
                              >
                                {paymentLabels[s.paymentStatus]}
                              </Badge>
                            </div>
                            {s.notes && <p className="text-xs text-muted-foreground italic">{s.notes}</p>}
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{formatCurrency(s.expectedAmount)}</div>
                            {s.paidAmount > 0 && s.paidAmount !== s.expectedAmount && (
                              <div className="text-xs text-muted-foreground">Pago: {formatCurrency(s.paidAmount)}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="invoices" className="mt-3">
                  {patientInvoices.length === 0 ? (
                    <p className="text-center text-muted-foreground py-6 text-sm">Nenhuma nota emitida</p>
                  ) : (
                    <div className="space-y-2">
                      {patientInvoices.map(inv => (
                        <div key={inv.id} className="p-3 rounded-lg border bg-card text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="font-medium flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary" />
                              {formatDate(inv.date)}
                            </div>
                            <div className="font-semibold text-primary">{formatCurrency(inv.amount)}</div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {inv.sessionIds?.length || 0} sessão(ões) vinculada(s)
                          </div>
                          {inv.notes && (
                            <p className="text-xs text-muted-foreground italic border-t pt-1 mt-1">{inv.notes}</p>
                          )}
                        </div>
                      ))}
                      <div className="pt-2 border-t mt-3 flex justify-between text-sm font-medium">
                        <span>Total em Notas</span>
                        <span className="text-primary">{formatCurrency(patientStats.invoiceTotal)}</span>
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
