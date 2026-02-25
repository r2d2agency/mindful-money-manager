import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PatientCombobox } from "@/components/PatientCombobox";
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
import { Plus, Trash2, CheckCircle, Search, Loader2, RefreshCw, ChevronLeft, ChevronRight, FileText, Calendar as CalendarIcon, Upload, Download } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
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
  const [calView, setCalView] = useState<"month" | "week" | "day">("month");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [dayDetailOpen, setDayDetailOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Invoice form
  const [invoiceForm, setInvoiceForm] = useState({ patientId: "", amount: "", date: new Date().toISOString().split("T")[0], notes: "", fileData: "", fileName: "" });
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
      const sDate = new Date(s.date + "T00:00:00");
      const matchFrom = !dateFrom || sDate >= dateFrom;
      const matchTo = !dateTo || sDate <= dateTo;
      return matchSearch && matchPsy && matchPatient && matchFrom && matchTo;
    });
  }, [sessions, patients, search, filterPsy, filterPatient, dateFrom, dateTo]);

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

  const getSessionsForDate = (date: Date) => {
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return filtered.filter(s => s.date?.startsWith(dateStr));
  };

  // Week helpers
  const weekDays = useMemo(() => {
    const ref = selectedDay || calMonth;
    const dayOfWeek = ref.getDay();
    const start = new Date(ref);
    start.setDate(start.getDate() - dayOfWeek);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [calMonth, selectedDay]);

  // Hours for day/week view
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 to 20:00

  function openDayDetail(day: number) {
    const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), day);
    setSelectedDay(date);
    setDayDetailOpen(true);
  }

  function openDayDetailDate(date: Date) {
    setSelectedDay(date);
    setDayDetailOpen(true);
  }

  const selectedDaySessions = useMemo(() => {
    if (!selectedDay) return [];
    return getSessionsForDate(selectedDay).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  }, [selectedDay, filtered]);

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
        fileData: invoiceForm.fileData,
        fileName: invoiceForm.fileName,
      });
      await loadAll();
      setInvoiceDialogOpen(false);
      setInvoiceForm({ patientId: "", amount: "", date: new Date().toISOString().split("T")[0], notes: "", fileData: "", fileName: "" });
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
                  <PatientCombobox
                    options={patients.map(p => ({ value: p.id, label: p.name }))}
                    value={invoiceForm.patientId}
                    onValueChange={v => { setInvoiceForm(f => ({ ...f, patientId: v })); setSelectedSessionIds([]); }}
                    placeholder="Selecione"
                  />
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
                <div>
                  <Label>Anexar Arquivo (opcional)</Label>
                  <div className="flex gap-2 mt-1">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*,.pdf";
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) { toast.error("Arquivo deve ter no máximo 2MB"); return; }
                        const reader = new FileReader();
                        reader.onload = () => {
                          setInvoiceForm(f => ({ ...f, fileData: reader.result as string, fileName: file.name }));
                          toast.success(`Arquivo "${file.name}" anexado`);
                        };
                        reader.readAsDataURL(file);
                      };
                      input.click();
                    }}>
                      <Upload className="mr-2 h-4 w-4" />
                      {invoiceForm.fileName || "Enviar Arquivo"}
                    </Button>
                    {invoiceForm.fileName && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => setInvoiceForm(f => ({ ...f, fileData: "", fileName: "" }))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Imagem ou PDF até 2MB</p>
                </div>
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
      <div className="flex gap-3 flex-wrap items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por paciente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <PatientCombobox
          options={patients.map(p => ({ value: p.id, label: p.name }))}
          value={filterPatient}
          onValueChange={setFilterPatient}
          placeholder="Paciente"
          showAll
          allLabel="Todos os Pacientes"
          className="w-[200px]"
        />
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
      <div className="flex gap-3 flex-wrap items-center">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "Data início"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateTo ? format(dateTo, "dd/MM/yyyy") : "Data fim"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarPicker mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>
        {(dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>Limpar datas</Button>
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
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => {
                  if (calView === "month") setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1));
                  else if (calView === "week") {
                    const d = new Date(selectedDay || calMonth);
                    d.setDate(d.getDate() - 7);
                    setSelectedDay(d); setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                  } else {
                    const d = new Date(selectedDay || calMonth);
                    d.setDate(d.getDate() - 1);
                    setSelectedDay(d); setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                  }
                }}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-base capitalize">
                  {calView === "month" && calMonth.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                  {calView === "week" && `${weekDays[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} — ${weekDays[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`}
                  {calView === "day" && (selectedDay || calMonth).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => {
                  if (calView === "month") setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1));
                  else if (calView === "week") {
                    const d = new Date(selectedDay || calMonth);
                    d.setDate(d.getDate() + 7);
                    setSelectedDay(d); setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                  } else {
                    const d = new Date(selectedDay || calMonth);
                    d.setDate(d.getDate() + 1);
                    setSelectedDay(d); setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                  }
                }}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => { setCalMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelectedDay(new Date()); }} className="text-xs mr-2">Hoje</Button>
                <Button variant={calView === "month" ? "default" : "outline"} size="sm" onClick={() => setCalView("month")} className="text-xs">Mês</Button>
                <Button variant={calView === "week" ? "default" : "outline"} size="sm" onClick={() => { setCalView("week"); if (!selectedDay) setSelectedDay(new Date()); }} className="text-xs">Semana</Button>
                <Button variant={calView === "day" ? "default" : "outline"} size="sm" onClick={() => { setCalView("day"); if (!selectedDay) setSelectedDay(new Date()); }} className="text-xs">Dia</Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* MONTH VIEW */}
              {calView === "month" && (
                <>
                  <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
                      <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                    ))}
                    {calendarDays.map((day, i) => {
                      const daySessions = day ? getSessionsForDay(day) : [];
                      const isToday = day && new Date().getDate() === day && new Date().getMonth() === calMonth.getMonth() && new Date().getFullYear() === calMonth.getFullYear();
                      return (
                        <div key={i}
                          className={`bg-background min-h-[80px] p-1 cursor-pointer hover:bg-accent/30 transition-colors ${!day ? "bg-muted/50 cursor-default" : ""} ${isToday ? "ring-2 ring-primary ring-inset" : ""}`}
                          onClick={() => day && openDayDetail(day)}
                        >
                          {day && (
                            <>
                              <span className={`text-xs font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{day}</span>
                              <div className="space-y-0.5 mt-0.5">
                                {daySessions.slice(0, 3).map(s => (
                                  <div key={s.id}
                                    className={`text-[10px] truncate px-1 rounded ${
                                      s.paymentStatus === "paid" ? "bg-success/20 text-success" :
                                      s.status === "cancelled" ? "bg-destructive/20 text-destructive" :
                                      "bg-primary/15 text-primary"
                                    }`}
                                    title={`${getPatientName(s.patientId)} - ${s.time || ""} - ${formatCurrency(s.expectedAmount)}`}
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
                </>
              )}

              {/* WEEK VIEW */}
              {calView === "week" && (
                <div className="overflow-x-auto">
                  <div className="grid grid-cols-8 gap-px bg-border rounded-lg overflow-hidden min-w-[700px]">
                    <div className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">Hora</div>
                    {weekDays.map(d => {
                      const isToday = d.toDateString() === new Date().toDateString();
                      return (
                        <div key={d.toISOString()} className={`bg-muted p-2 text-center text-xs font-medium cursor-pointer hover:bg-accent/50 ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}
                          onClick={() => { setSelectedDay(d); setCalView("day"); }}
                        >
                          {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}<br />
                          <span className={`text-sm ${isToday ? "bg-primary text-primary-foreground rounded-full w-6 h-6 inline-flex items-center justify-center" : ""}`}>{d.getDate()}</span>
                        </div>
                      );
                    })}
                    {hours.map(h => (
                      <>
                        <div key={`h-${h}`} className="bg-background p-1 text-xs text-muted-foreground text-right pr-2 border-t border-border">
                          {String(h).padStart(2, "0")}:00
                        </div>
                        {weekDays.map(d => {
                          const daySessions = getSessionsForDate(d).filter(s => {
                            const sHour = parseInt(s.time?.split(":")[0] || "-1");
                            return sHour === h;
                          });
                          return (
                            <div key={`${d.toISOString()}-${h}`} className="bg-background min-h-[48px] p-0.5 border-t border-border cursor-pointer hover:bg-accent/20"
                              onClick={() => openDayDetailDate(d)}
                            >
                              {daySessions.map(s => (
                                <div key={s.id}
                                  className={`text-[10px] truncate px-1 py-0.5 rounded mb-0.5 ${
                                    s.paymentStatus === "paid" ? "bg-success/20 text-success" :
                                    s.status === "cancelled" ? "bg-destructive/20 text-destructive" :
                                    "bg-primary/15 text-primary"
                                  }`}
                                >
                                  <span className="font-semibold">{s.time}</span> {getPatientName(s.patientId)}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </>
                    ))}
                  </div>
                </div>
              )}

              {/* DAY VIEW */}
              {calView === "day" && (
                <div className="space-y-0">
                  {hours.map(h => {
                    const daySessions = getSessionsForDate(selectedDay || calMonth).filter(s => {
                      const sHour = parseInt(s.time?.split(":")[0] || "-1");
                      return sHour === h;
                    });
                    return (
                      <div key={h} className="flex border-t border-border min-h-[56px]">
                        <div className="w-16 shrink-0 p-2 text-xs text-muted-foreground text-right pr-3">
                          {String(h).padStart(2, "0")}:00
                        </div>
                        <div className="flex-1 p-1 space-y-1">
                          {daySessions.map(s => (
                            <div key={s.id}
                              className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                                s.paymentStatus === "paid" ? "bg-success/10 border border-success/30" :
                                s.status === "cancelled" ? "bg-destructive/10 border border-destructive/30" :
                                "bg-primary/5 border border-primary/20 hover:bg-primary/10"
                              }`}
                              onClick={() => s.paymentStatus !== "paid" && openPayDialog(s)}
                            >
                              <div>
                                <span className="font-medium text-sm">{getPatientName(s.patientId)}</span>
                                <span className="text-xs text-muted-foreground ml-2">{s.time} · {s.duration || 50}min</span>
                                <span className="text-xs text-muted-foreground ml-2">{getPsyName(s.psychologistId)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold">{formatCurrency(s.expectedAmount)}</span>
                                <Badge variant={s.paymentStatus === "paid" ? "default" : s.paymentStatus === "partial" ? "outline" : "secondary"}
                                  className={`text-xs ${s.paymentStatus === "paid" ? "bg-success text-success-foreground" : ""}`}>
                                  {paymentLabels[s.paymentStatus]}
                                </Badge>
                                {s.paymentStatus !== "paid" && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openPayDialog(s); }}>
                                    <CheckCircle className="h-4 w-4 text-success" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {/* Sessions without time */}
                  {(() => {
                    const noTimeSessions = getSessionsForDate(selectedDay || calMonth).filter(s => !s.time);
                    if (noTimeSessions.length === 0) return null;
                    return (
                      <div className="border-t border-border pt-2 mt-2">
                        <p className="text-xs text-muted-foreground mb-2 px-2">Sem horário definido</p>
                        {noTimeSessions.map(s => (
                          <div key={s.id}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer mx-1 mb-1 ${
                              s.paymentStatus === "paid" ? "bg-success/10 border border-success/30" :
                              "bg-primary/5 border border-primary/20 hover:bg-primary/10"
                            }`}
                            onClick={() => s.paymentStatus !== "paid" && openPayDialog(s)}
                          >
                            <div>
                              <span className="font-medium text-sm">{getPatientName(s.patientId)}</span>
                              <span className="text-xs text-muted-foreground ml-2">{getPsyName(s.psychologistId)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">{formatCurrency(s.expectedAmount)}</span>
                              <Badge variant={s.paymentStatus === "paid" ? "default" : "secondary"}
                                className={`text-xs ${s.paymentStatus === "paid" ? "bg-success text-success-foreground" : ""}`}>
                                {paymentLabels[s.paymentStatus]}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary/15" /> Agendada</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-success/20" /> Paga</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-destructive/20" /> Cancelada</span>
              </div>
            </CardContent>
          </Card>

          {/* Day detail dialog */}
          <Dialog open={dayDetailOpen} onOpenChange={setDayDetailOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {selectedDay?.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                </DialogTitle>
              </DialogHeader>
              {selectedDaySessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">Nenhuma sessão neste dia</p>
              ) : (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {selectedDaySessions.map(s => (
                    <div key={s.id} className={`p-3 rounded-lg border ${
                      s.paymentStatus === "paid" ? "border-success/30 bg-success/5" :
                      s.status === "cancelled" ? "border-destructive/30 bg-destructive/5" :
                      "border-border"
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="font-semibold">{getPatientName(s.patientId)}</span>
                          {s.time && <span className="text-sm text-muted-foreground ml-2">{s.time} · {s.duration || 50}min</span>}
                        </div>
                        <Badge variant={s.paymentStatus === "paid" ? "default" : s.paymentStatus === "partial" ? "outline" : "secondary"}
                          className={`text-xs ${s.paymentStatus === "paid" ? "bg-success text-success-foreground" : ""}`}>
                          {paymentLabels[s.paymentStatus]}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <span className="text-muted-foreground">{getPsyName(s.psychologistId)}</span>
                          <span className="ml-3 font-medium">{formatCurrency(s.expectedAmount)}</span>
                          {s.paidAmount > 0 && s.paymentStatus !== "paid" && (
                            <span className="text-success ml-2">(pago: {formatCurrency(s.paidAmount)})</span>
                          )}
                        </div>
                        {s.paymentStatus !== "paid" && s.status !== "cancelled" && (
                          <Button size="sm" variant="outline" onClick={() => { setDayDetailOpen(false); openPayDialog(s); }}>
                            <CheckCircle className="mr-1 h-3 w-3 text-success" />Baixar
                          </Button>
                        )}
                      </div>
                      {s.invoiceId && (
                        <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                          <FileText className="h-3 w-3" /> Nota vinculada
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between text-sm font-medium">
                    <span>Total do dia</span>
                    <span>{formatCurrency(selectedDaySessions.filter(s => s.status !== "cancelled").reduce((sum, s) => sum + s.expectedAmount, 0))}</span>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
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
                      <TableHead>Sessões</TableHead><TableHead>Arquivo</TableHead><TableHead>Obs</TableHead>
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
                        <TableCell>
                          {inv.fileData ? (
                            <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
                              const a = document.createElement("a");
                              a.href = inv.fileData!;
                              a.download = inv.fileName || "nota";
                              a.click();
                            }}>
                              <Download className="mr-1 h-3 w-3" />{inv.fileName || "Baixar"}
                            </Button>
                          ) : "—"}
                        </TableCell>
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
