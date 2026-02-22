import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  fetchSessions, createSession, updateSession, deleteSession,
  fetchPatients, fetchPsychologists, fetchRecurringPlans, createRecurringPlan,
  deleteRecurringPlan, generateRecurringSessions, fetchInvoices, createInvoice, deleteInvoice
} from "@/lib/api";
import { formatCurrency, formatDate, DAYS_OF_WEEK } from "@/lib/format";
import { Plus, Trash2, CheckCircle, Search, Loader2, RefreshCw, ChevronLeft, ChevronRight, FileText, Calendar as CalendarIcon } from "lucide-react";
import { toast } from "sonner";
import { Session, Patient, Psychologist, RecurringPlan, Invoice } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

const statusLabels: Record<string, string> = { scheduled: "Agendada", completed: "Realizada", cancelled: "Cancelada" };
const paymentLabels: Record<string, string> = { pending: "Pendente", paid: "Pago", partial: "Parcial" };

export default function Sessions() {
  const { isAdmin } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [recurringPlans, setRecurringPlans] = useState<RecurringPlan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [search, setSearch] = useState("");
  const [filterPsy, setFilterPsy] = useState("all");
  const [filterPatient, setFilterPatient] = useState("all");
  const [saving, setSaving] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());

  // Invoice form
  const [invoiceForm, setInvoiceForm] = useState({ patientId: "", amount: "", date: new Date().toISOString().split("T")[0], notes: "" });
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);

  const [form, setForm] = useState({ patientId: "", psychologistId: "", date: "", time: "", duration: "50", expectedAmount: "", notes: "" });
  const [recurringForm, setRecurringForm] = useState({ patientId: "", psychologistId: "", amount: "", schedules: [{ dayOfWeek: 1, time: "09:00" }] as { dayOfWeek: number; time: string }[] });

  async function loadAll() {
    setLoading(true);
    try {
      const [s, p, psy, rp, inv] = await Promise.all([
        fetchSessions(), fetchPatients(), fetchPsychologists(), fetchRecurringPlans(), fetchInvoices()
      ]);
      setSessions(s); setPatients(p); setPsychologists(psy); setRecurringPlans(rp); setInvoices(inv);
    } finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, []);

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      const patient = patients.find(p => p.id === s.patientId);
      const matchSearch = !search || patient?.name.toLowerCase().includes(search.toLowerCase());
      const matchPsy = filterPsy === "all" || s.psychologistId === filterPsy;
      const matchPatient = filterPatient === "all" || s.patientId === filterPatient;
      return matchSearch && matchPsy && matchPatient;
    });
  }, [sessions, patients, search, filterPsy, filterPatient]);

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [calMonth]);

  const getSessionsForDay = (day: number) => {
    const dateStr = `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return filtered.filter(s => s.date?.startsWith(dateStr));
  };

  async function handleSave() {
    if (!form.patientId || !form.date || !form.expectedAmount) { toast.error("Preencha os campos obrigatórios"); return; }
    setSaving(true);
    try {
      await createSession({
        patientId: form.patientId, psychologistId: form.psychologistId, date: form.date,
        time: form.time, duration: parseInt(form.duration) || 50,
        status: "scheduled", paymentStatus: "pending", expectedAmount: parseFloat(form.expectedAmount),
        paidAmount: 0, isRecurring: false, notes: form.notes,
      });
      setSessions(await fetchSessions());
      setDialogOpen(false);
      setForm({ patientId: "", psychologistId: "", date: "", time: "", duration: "50", expectedAmount: "", notes: "" });
      toast.success("Sessão agendada");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleSaveRecurring() {
    if (!recurringForm.patientId || !recurringForm.amount || recurringForm.schedules.length === 0) { toast.error("Preencha os campos obrigatórios"); return; }
    setSaving(true);
    try {
      const result = await createRecurringPlan({
        patientId: recurringForm.patientId,
        psychologistId: recurringForm.psychologistId,
        schedules: recurringForm.schedules,
        amount: parseFloat(recurringForm.amount),
      } as any);
      // Generate sessions for each plan created
      const plans = Array.isArray(result) ? result : [result];
      for (const plan of plans) {
        await generateRecurringSessions(plan.id, 8);
      }
      await loadAll();
      setRecurringDialogOpen(false);
      setRecurringForm({ patientId: "", psychologistId: "", amount: "", schedules: [{ dayOfWeek: 1, time: "09:00" }] });
      toast.success(`Plano recorrente criado (${plans.length} dia${plans.length > 1 ? "s" : ""}) e sessões geradas para 8 semanas`);
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleGenerateMore(planId: string) {
    setSaving(true);
    try {
      await generateRecurringSessions(planId, 4);
      setSessions(await fetchSessions());
      toast.success("Sessões futuras geradas");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  async function handleCreateInvoice() {
    if (!invoiceForm.patientId || !invoiceForm.amount || selectedSessionIds.length === 0) {
      toast.error("Selecione paciente, valor e sessões"); return;
    }
    setSaving(true);
    try {
      const patient = patients.find(p => p.id === invoiceForm.patientId);
      await createInvoice({
        patientId: invoiceForm.patientId,
        psychologistId: patient?.psychologistId || "",
        amount: parseFloat(invoiceForm.amount),
        date: invoiceForm.date,
        sessionIds: selectedSessionIds,
        notes: invoiceForm.notes,
      });
      await loadAll();
      setInvoiceDialogOpen(false);
      setInvoiceForm({ patientId: "", amount: "", date: new Date().toISOString().split("T")[0], notes: "" });
      setSelectedSessionIds([]);
      toast.success("Nota emitida e sessões marcadas como pagas");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  function openPayDialog(s: Session) { setSelectedSession(s); setPayAmount(String(s.expectedAmount - s.paidAmount)); setPayDialogOpen(true); }

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

  const unpaidSessionsForPatient = useMemo(() => {
    if (!invoiceForm.patientId) return [];
    return sessions.filter(s => s.patientId === invoiceForm.patientId && s.paymentStatus !== "paid");
  }, [invoiceForm.patientId, sessions]);

  // Auto-calculate amount from selected sessions
  useEffect(() => {
    if (selectedSessionIds.length > 0) {
      const total = sessions.filter(s => selectedSessionIds.includes(s.id)).reduce((sum, s) => sum + s.expectedAmount, 0);
      setInvoiceForm(f => ({ ...f, amount: String(total) }));
    }
  }, [selectedSessionIds, sessions]);

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessões</h1>
          <p className="text-muted-foreground">Controle de sessões, recorrências e pagamentos</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={recurringDialogOpen} onOpenChange={setRecurringDialogOpen}>
            <DialogTrigger asChild><Button variant="outline"><RefreshCw className="mr-2 h-4 w-4" />Plano Recorrente</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Plano Recorrente</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Paciente *</Label>
                  <Select value={recurringForm.patientId} onValueChange={v => setRecurringForm(f => ({ ...f, patientId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{patients.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                {isAdmin && (
                  <div>
                    <Label>Psicólogo</Label>
                    <Select value={recurringForm.psychologistId} onValueChange={v => setRecurringForm(f => ({ ...f, psychologistId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{psychologists.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Valor por Sessão *</Label>
                  <Input type="number" value={recurringForm.amount} onChange={e => setRecurringForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>Dias e Horários *</Label>
                    <Button type="button" variant="outline" size="sm" onClick={() => setRecurringForm(f => ({ ...f, schedules: [...f.schedules, { dayOfWeek: 1, time: "09:00" }] }))}>
                      <Plus className="mr-1 h-3 w-3" />Adicionar Dia
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {recurringForm.schedules.map((sched, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Select value={String(sched.dayOfWeek)} onValueChange={v => {
                          const updated = [...recurringForm.schedules];
                          updated[idx] = { ...updated[idx], dayOfWeek: parseInt(v) };
                          setRecurringForm(f => ({ ...f, schedules: updated }));
                        }}>
                          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>{DAYS_OF_WEEK.map((d, i) => (<SelectItem key={i} value={String(i)}>{d}</SelectItem>))}</SelectContent>
                        </Select>
                        <Input type="time" value={sched.time} className="w-[120px]" onChange={e => {
                          const updated = [...recurringForm.schedules];
                          updated[idx] = { ...updated[idx], time: e.target.value };
                          setRecurringForm(f => ({ ...f, schedules: updated }));
                        }} />
                        {recurringForm.schedules.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => {
                            setRecurringForm(f => ({ ...f, schedules: f.schedules.filter((_, i) => i !== idx) }));
                          }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Serão geradas sessões automaticamente para as próximas 8 semanas em cada dia selecionado.</p>
                <Button onClick={handleSaveRecurring} className="w-full" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Criar Plano e Gerar Sessões
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
            <DialogTrigger asChild><Button variant="outline"><FileText className="mr-2 h-4 w-4" />Emitir Nota</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Emitir Nota / Recibo</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Paciente *</Label>
                  <Select value={invoiceForm.patientId} onValueChange={v => { setInvoiceForm(f => ({ ...f, patientId: v })); setSelectedSessionIds([]); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{patients.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                {unpaidSessionsForPatient.length > 0 && (
                  <div>
                    <Label>Sessões na Nota *</Label>
                    <div className="max-h-40 overflow-y-auto space-y-2 border rounded-md p-2">
                      {unpaidSessionsForPatient.map(s => (
                        <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={selectedSessionIds.includes(s.id)}
                            onCheckedChange={(checked) => {
                              setSelectedSessionIds(prev => checked ? [...prev, s.id] : prev.filter(id => id !== s.id));
                            }}
                          />
                          <span>{formatDate(s.date)} — {formatCurrency(s.expectedAmount)}</span>
                          <Badge variant="secondary" className="text-xs">{statusLabels[s.status]}</Badge>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Valor Total *</Label><Input type="number" value={invoiceForm.amount} onChange={e => setInvoiceForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" /></div>
                  <div><Label>Data *</Label><Input type="date" value={invoiceForm.date} onChange={e => setInvoiceForm(f => ({ ...f, date: e.target.value }))} /></div>
                </div>
                <div><Label>Observações</Label><Input value={invoiceForm.notes} onChange={e => setInvoiceForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <Button onClick={handleCreateInvoice} className="w-full" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Emitir Nota
                </Button>
              </div>
            </DialogContent>
          </Dialog>

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
                {isAdmin && (
                  <div>
                    <Label>Psicólogo</Label>
                    <Select value={form.psychologistId} onValueChange={v => setForm(f => ({ ...f, psychologistId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{psychologists.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Data *</Label><Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                  <div><Label>Horário</Label><Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Duração (min)</Label><Input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} placeholder="50" /></div>
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
      </div>

      {/* Pay dialog */}
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
              </div>
              <Button onClick={handlePay} className="w-full" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirmar Pagamento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por paciente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterPatient} onValueChange={setFilterPatient}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Paciente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Pacientes</SelectItem>
            {patients.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
          </SelectContent>
        </Select>
        {isAdmin && (
          <Select value={filterPsy} onValueChange={setFilterPsy}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Psicólogo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Psicólogos</SelectItem>
              {psychologists.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar"><CalendarIcon className="mr-1 h-4 w-4" />Calendário</TabsTrigger>
          <TabsTrigger value="list">Lista</TabsTrigger>
          <TabsTrigger value="recurring"><RefreshCw className="mr-1 h-4 w-4" />Recorrências</TabsTrigger>
          <TabsTrigger value="invoices"><FileText className="mr-1 h-4 w-4" />Notas</TabsTrigger>
        </TabsList>

        {/* CALENDAR VIEW */}
        <TabsContent value="calendar">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Button variant="ghost" size="icon" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-base capitalize">
                {calMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
                  <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                ))}
                {calendarDays.map((day, i) => {
                  const daySessions = day ? getSessionsForDay(day) : [];
                  const isToday = day && new Date().getDate() === day && new Date().getMonth() === calMonth.getMonth() && new Date().getFullYear() === calMonth.getFullYear();
                  return (
                    <div key={i} className={`bg-background min-h-[80px] p-1 ${!day ? "bg-muted/50" : ""} ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}>
                      {day && (
                        <>
                          <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</span>
                          <div className="space-y-0.5 mt-0.5">
                            {daySessions.slice(0, 3).map(s => (
                              <div key={s.id}
                                className={`text-[10px] truncate px-1 rounded cursor-pointer ${
                                  s.paymentStatus === "paid" ? "bg-success/20 text-success" :
                                  s.status === "cancelled" ? "bg-destructive/20 text-destructive" :
                                  "bg-primary/15 text-primary"
                                }`}
                                onClick={() => s.paymentStatus !== "paid" && openPayDialog(s)}
                                title={`${getPatientName(s.patientId)} - ${s.time || ""} ${s.duration ? s.duration + "min" : ""} - ${formatCurrency(s.expectedAmount)}`}
                              >
                                {s.time ? <span className="font-semibold">{s.time}</span> : null}
                                {s.time ? " " : ""}{getPatientName(s.patientId)}
                              </div>
                            ))}
                            {daySessions.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">+{daySessions.length - 3}</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary/15" /> Agendada</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-success/20" /> Paga</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive/20" /> Cancelada</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LIST VIEW */}
        <TabsContent value="list">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>Data</TableHead><TableHead>Horário</TableHead><TableHead>Duração</TableHead>
                     <TableHead>Paciente</TableHead><TableHead>Psicólogo</TableHead>
                     <TableHead>Status</TableHead><TableHead>Pagamento</TableHead><TableHead>Valor</TableHead>
                     <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                   <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma sessão encontrada</TableCell></TableRow>
                  ) : filtered.map(s => (
                    <TableRow key={s.id}>
                      <TableCell>{formatDate(s.date)}</TableCell>
                      <TableCell>{s.time || "—"}</TableCell>
                      <TableCell>{s.duration ? `${s.duration}min` : "—"}</TableCell>
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
                              <CheckCircle className="h-4 w-4 text-green-600" />
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
        </TabsContent>

        {/* RECURRING PLANS */}
        <TabsContent value="recurring">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Planos Recorrentes</CardTitle>
            </CardHeader>
            <CardContent>
              {recurringPlans.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum plano recorrente criado</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead><TableHead>Psicólogo</TableHead>
                      <TableHead>Dia</TableHead><TableHead>Horário</TableHead><TableHead>Valor</TableHead>
                      <TableHead className="w-[140px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recurringPlans.map(rp => (
                      <TableRow key={rp.id}>
                        <TableCell className="font-medium">{getPatientName(rp.patientId)}</TableCell>
                        <TableCell>{getPsyName(rp.psychologistId)}</TableCell>
                        <TableCell>{DAYS_OF_WEEK[rp.dayOfWeek]}</TableCell>
                        <TableCell>{rp.time}</TableCell>
                        <TableCell>{formatCurrency(rp.amount)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" onClick={() => handleGenerateMore(rp.id)} disabled={saving}>
                              <RefreshCw className="mr-1 h-3 w-3" />+4 sem
                            </Button>
                            <Button variant="ghost" size="icon" onClick={async () => {
                              await deleteRecurringPlan(rp.id);
                              setRecurringPlans(await fetchRecurringPlans());
                              toast.success("Plano removido");
                            }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* INVOICES */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notas / Recibos</CardTitle>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma nota emitida</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead><TableHead>Paciente</TableHead>
                      <TableHead>Psicólogo</TableHead><TableHead>Valor</TableHead>
                      <TableHead>Sessões</TableHead><TableHead>Obs</TableHead>
                      <TableHead className="w-[60px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map(inv => (
                      <TableRow key={inv.id}>
                        <TableCell>{formatDate(inv.date)}</TableCell>
                        <TableCell className="font-medium">{getPatientName(inv.patientId)}</TableCell>
                        <TableCell>{getPsyName(inv.psychologistId)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(inv.amount)}</TableCell>
                        <TableCell><Badge variant="secondary">{inv.sessionIds?.length || 0} sessões</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">{inv.notes}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={async () => {
                            await deleteInvoice(inv.id);
                            await loadAll();
                            toast.success("Nota removida");
                          }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
