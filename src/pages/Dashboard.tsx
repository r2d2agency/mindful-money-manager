import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fetchPatients, fetchPsychologists, fetchSessions, fetchInvoices, updateSession } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { Users, Calendar as CalendarIcon, DollarSign, TrendingUp, Loader2, BarChart3, User, AlertTriangle, Clock, Download, FileText, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { Patient, Psychologist, Session, Invoice } from "@/types";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { PatientCombobox } from "@/components/PatientCombobox";
import { toast } from "sonner";

const CHART_COLORS = [
  "hsl(199, 89%, 38%)",
  "hsl(168, 60%, 42%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(270, 60%, 50%)",
  "hsl(330, 60%, 50%)",
  "hsl(120, 50%, 40%)",
  "hsl(210, 70%, 55%)",
];

const statusLabels: Record<string, string> = { scheduled: "Agendada", completed: "Realizada", cancelled: "Cancelada" };
const paymentLabels: Record<string, string> = { pending: "Pendente", paid: "Pago", partial: "Parcial" };

export default function Dashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPatient, setFilterPatient] = useState("all");
  const [baixaSession, setBaixaSession] = useState<Session | null>(null);
  const [baixaAmount, setBaixaAmount] = useState("");
  const [baixaLoading, setBaixaLoading] = useState(false);

  async function handleBaixa() {
    if (!baixaSession) return;
    setBaixaLoading(true);
    try {
      const amount = parseFloat(baixaAmount) || 0;
      const newPaid = baixaSession.paidAmount + amount;
      const isFullyPaid = newPaid >= baixaSession.expectedAmount;
      const status = isFullyPaid ? "paid" : "partial";
      const finalPaid = isFullyPaid ? baixaSession.expectedAmount : newPaid;
      await updateSession(baixaSession.id, { paymentStatus: status, paidAmount: finalPaid });
      setSessions(prev => prev.map(s => s.id === baixaSession.id ? { ...s, paymentStatus: status, paidAmount: finalPaid } : s));
      toast.success(isFullyPaid ? "Pagamento integral registrado!" : `Baixa parcial de ${formatCurrency(amount)} registrada. Saldo restante: ${formatCurrency(baixaSession.expectedAmount - finalPaid)}`);
      setBaixaSession(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao dar baixa");
    } finally {
      setBaixaLoading(false);
    }
  }

  // Date range
  const [dateFrom, setDateFrom] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [dateTo, setDateTo] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 0);
    return d;
  });

  useEffect(() => {
    Promise.all([fetchPatients(), fetchPsychologists(), fetchSessions(), fetchInvoices()])
      .then(([p, psy, s, inv]) => { setPatients(p); setPsychologists(psy); setSessions(s); setInvoices(inv); })
      .finally(() => setLoading(false));
  }, []);

  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      const matchPatient = filterPatient === "all" || s.patientId === filterPatient;
      const sessionDate = s.date;
      const matchFrom = !dateFrom || sessionDate >= dateFrom.toISOString().split("T")[0];
      const matchTo = !dateTo || sessionDate <= dateTo.toISOString().split("T")[0];
      return matchPatient && matchFrom && matchTo;
    });
  }, [sessions, filterPatient, dateFrom, dateTo]);

  const totalReceived = filteredSessions.filter(s => s.paymentStatus === "paid").reduce((sum, s) => sum + s.paidAmount, 0);
  const totalPending = filteredSessions.filter(s => s.paymentStatus !== "paid" && s.status !== "cancelled").reduce((sum, s) => sum + s.expectedAmount - s.paidAmount, 0);
  const completedSessions = filteredSessions.filter(s => s.status === "completed").length;
  const scheduledSessions = filteredSessions.filter(s => s.status === "scheduled").length;
  const totalSessions = filteredSessions.filter(s => s.status !== "cancelled").length;

  // Monthly projection data
  const monthlyData = useMemo(() => {
    const months: Record<string, { key: string; received: number; pending: number; projected: number }> = {};
    const now = new Date();
    for (let i = -5; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      months[key] = { key: label, received: 0, pending: 0, projected: 0 };
    }
    filteredSessions.forEach(s => {
      if (s.status === "cancelled") return;
      const d = new Date(s.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (months[key]) {
        if (s.paymentStatus === "paid") months[key].received += s.paidAmount;
        else {
          const isPast = d < now;
          if (isPast) months[key].pending += s.expectedAmount - s.paidAmount;
          else months[key].projected += s.expectedAmount;
        }
      }
    });
    return Object.values(months);
  }, [filteredSessions]);

  // Per-patient summary
  const patientSummary = useMemo(() => {
    const map: Record<string, { name: string; total: number; received: number; pending: number; sessionsCount: number }> = {};
    filteredSessions.filter(s => s.status !== "cancelled").forEach(s => {
      if (!map[s.patientId]) {
        const p = patients.find(p => p.id === s.patientId);
        map[s.patientId] = { name: p?.name || "—", total: 0, received: 0, pending: 0, sessionsCount: 0 };
      }
      map[s.patientId].sessionsCount++;
      map[s.patientId].total += s.expectedAmount;
      if (s.paymentStatus === "paid") map[s.patientId].received += s.paidAmount;
      else map[s.patientId].pending += s.expectedAmount - s.paidAmount;
    });
    return Object.entries(map).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.total - a.total);
  }, [filteredSessions, patients]);

  // Revenue by psychologist
  const psychologistData = useMemo(() => {
    return psychologists.map(p => {
      const psySessions = filteredSessions.filter(s => s.psychologistId === p.id && s.status !== "cancelled");
      const received = psySessions.filter(s => s.paymentStatus === "paid").reduce((sum, s) => sum + s.paidAmount, 0);
      const pending = psySessions.filter(s => s.paymentStatus !== "paid").reduce((sum, s) => sum + s.expectedAmount - s.paidAmount, 0);
      return { name: p.name, received, pending, total: received + pending };
    }).filter(d => d.total > 0);
  }, [filteredSessions, psychologists]);

  // Cumulative
  const cumulativeData = useMemo(() => {
    let cumReceived = 0;
    let cumTotal = 0;
    return monthlyData.map(m => {
      cumReceived += m.received;
      cumTotal += m.received + m.pending + m.projected;
      return { month: m.key, recebidoAcumulado: cumReceived, totalAcumulado: cumTotal };
    });
  }, [monthlyData]);

  const selectedPatientName = filterPatient === "all" ? null : patients.find(p => p.id === filterPatient)?.name;

  // Alerts: overdue sessions
  const overdueAlerts = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return sessions
      .filter(s => {
        const matchPatient = filterPatient === "all" || s.patientId === filterPatient;
        return matchPatient && s.date < today && s.paymentStatus !== "paid" && s.status !== "cancelled" && s.paidAmount < s.expectedAmount;
      })
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 10);
  }, [sessions, filterPatient]);

  // Upcoming sessions today/tomorrow
  const upcomingToday = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
    return sessions
      .filter(s => {
        const matchPatient = filterPatient === "all" || s.patientId === filterPatient;
        return matchPatient && (s.date === today || s.date === tomorrow) && s.status === "scheduled";
      })
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""));
  }, [sessions, filterPatient]);

  const getPatientName = (id: string) => patients.find(p => p.id === id)?.name || "—";
  const getPsyName = (id: string) => psychologists.find(p => p.id === id)?.name || "—";

  // Export summary as CSV
  function exportCSV() {
    const patientName = selectedPatientName || "Todos";
    const fromStr = dateFrom ? format(dateFrom, "dd/MM/yyyy") : "—";
    const toStr = dateTo ? format(dateTo, "dd/MM/yyyy") : "—";
    
    let csv = `Resumo Financeiro - ${patientName}\n`;
    csv += `Período: ${fromStr} a ${toStr}\n\n`;
    csv += `Data,Hora,Paciente,Psicólogo,Status,Pagamento,Valor Previsto,Valor Pago,Observações\n`;
    
    const sorted = [...filteredSessions].filter(s => s.status !== "cancelled").sort((a, b) => a.date.localeCompare(b.date));
    sorted.forEach(s => {
      csv += `${formatDate(s.date)},${s.time || "—"},${getPatientName(s.patientId)},${getPsyName(s.psychologistId)},${statusLabels[s.status]},${paymentLabels[s.paymentStatus]},${s.expectedAmount.toFixed(2)},${s.paidAmount.toFixed(2)},"${s.notes || ""}"\n`;
    });
    
    csv += `\nTotal Previsto,,,,,,,${(totalReceived + totalPending).toFixed(2)}\n`;
    csv += `Total Recebido,,,,,,,${totalReceived.toFixed(2)}\n`;
    csv += `Total Pendente,,,,,,,${totalPending.toFixed(2)}\n`;
    
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `resumo-financeiro-${patientName.replace(/\s/g, "-")}-${fromStr.replace(/\//g, "-")}.csv`;
    a.click();
  }

  if (loading) return (
    <div className="flex h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {selectedPatientName ? `Visão financeira — ${selectedPatientName}` : "Visão geral da clínica"}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-end">
          {/* Date range */}
          <div className="flex gap-2 items-end">
            <div>
              <Label className="text-xs text-muted-foreground">De</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {dateFrom ? format(dateFrom, "dd/MM/yy") : "Início"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {dateTo ? format(dateTo, "dd/MM/yy") : "Fim"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <PatientCombobox
            options={patients.map(p => ({ value: p.id, label: p.name }))}
            value={filterPatient}
            onValueChange={setFilterPatient}
            showAll
            allLabel="Todos os Pacientes"
            className="w-[200px]"
          />

          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="mr-1 h-4 w-4" />Exportar CSV
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {(overdueAlerts.length > 0 || upcomingToday.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {overdueAlerts.length > 0 && (
            <Card className="border-warning/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  Pagamentos Vencidos ({overdueAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {overdueAlerts.map(s => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-warning/5 border border-warning/20 text-sm cursor-pointer hover:bg-warning/10 transition-colors"
                      onClick={() => { setBaixaSession(s); setBaixaAmount(String(s.expectedAmount - s.paidAmount)); }}
                    >
                      <div>
                        <span className="font-medium">{getPatientName(s.patientId)}</span>
                        <span className="text-muted-foreground ml-2">{formatDate(s.date)}</span>
                        {s.paidAmount > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">(pago: {formatCurrency(s.paidAmount)})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {s.paymentStatus === "partial" && (
                          <Badge variant="secondary" className="text-xs">Parcial</Badge>
                        )}
                        <Badge variant="outline" className="text-warning border-warning">
                          {formatCurrency(s.expectedAmount - s.paidAmount)}
                        </Badge>
                        <CheckCircle className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {upcomingToday.length > 0 && (
            <Card className="border-primary/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-primary">
                  <Clock className="h-4 w-4" />
                  Sessões Hoje/Amanhã ({upcomingToday.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {upcomingToday.map(s => {
                    const isToday = s.date === new Date().toISOString().split("T")[0];
                    return (
                      <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-primary/5 border border-primary/20 text-sm">
                        <div>
                          <Badge variant={isToday ? "default" : "secondary"} className="mr-2 text-xs">
                            {isToday ? "Hoje" : "Amanhã"}
                          </Badge>
                          <span className="font-medium">{getPatientName(s.patientId)}</span>
                          {s.time && <span className="text-muted-foreground ml-2">{s.time}</span>}
                        </div>
                        <span className="text-muted-foreground">{formatCurrency(s.expectedAmount)}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessões</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSessions}</div>
            <p className="text-xs text-muted-foreground">{completedSessions} realizadas · {scheduledSessions} agendadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pacientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filterPatient === "all" ? patients.length : 1}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recebido</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-success">{formatCurrency(totalReceived)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendente</CardTitle>
            <TrendingUp className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-warning">{formatCurrency(totalPending)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Previsão Total</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{formatCurrency(totalReceived + totalPending)}</div></CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Projeção Mensal</CardTitle></CardHeader>
          <CardContent>
            {monthlyData.some(m => m.received + m.pending + m.projected > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="key" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="received" name="Recebido" fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="pending" name="Pendente" fill="hsl(38, 92%, 50%)" radius={[0, 0, 0, 0]} stackId="a" />
                  <Bar dataKey="projected" name="Projetado" fill="hsl(199, 89%, 38%)" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Adicione sessões para ver a projeção
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Evolução Acumulada</CardTitle></CardHeader>
          <CardContent>
            {cumulativeData.some(m => m.totalAcumulado > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="recebidoAcumulado" name="Recebido Acumulado" stroke="hsl(152, 60%, 40%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="totalAcumulado" name="Previsto Acumulado" stroke="hsl(199, 89%, 38%)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                Adicione sessões para ver a evolução
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Session Details Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Sessões do Período ({filteredSessions.filter(s => s.status !== "cancelled").length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredSessions.filter(s => s.status !== "cancelled").length > 0 ? (
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Hora</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Psicólogo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Previsto</TableHead>
                    <TableHead className="text-right">Pago</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions
                    .filter(s => s.status !== "cancelled")
                    .sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""))
                    .map(s => (
                    <TableRow key={s.id}>
                      <TableCell>{formatDate(s.date)}</TableCell>
                      <TableCell>{s.time || "—"}</TableCell>
                      <TableCell className="font-medium">{getPatientName(s.patientId)}</TableCell>
                      <TableCell>{getPsyName(s.psychologistId)}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "completed" ? "default" : "secondary"} className="text-xs">
                          {statusLabels[s.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={s.paymentStatus === "paid" ? "default" : "outline"}
                          className={cn("text-xs", s.paymentStatus === "paid" && "bg-success text-success-foreground")}
                        >
                          {paymentLabels[s.paymentStatus]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(s.expectedAmount)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {s.paidAmount > 0 ? (
                          <span className="text-success">{formatCurrency(s.paidAmount)}</span>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Totals row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={6} className="text-right">TOTAIS</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalReceived + totalPending)}</TableCell>
                    <TableCell className="text-right text-success">{formatCurrency(totalReceived)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex h-[120px] items-center justify-center text-muted-foreground">
              Nenhuma sessão no período selecionado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts Row 2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Receita por Psicólogo</CardTitle></CardHeader>
          <CardContent>
            {psychologistData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={psychologistData} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                    {psychologistData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground">
                Sem dados no período
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per-patient financial table */}
        <Card>
          <CardHeader><CardTitle className="text-base">Resumo por Paciente</CardTitle></CardHeader>
          <CardContent>
            {patientSummary.length > 0 ? (
              <div className="max-h-[280px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead className="text-right">Sessões</TableHead>
                      <TableHead className="text-right">Recebido</TableHead>
                      <TableHead className="text-right">Pendente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patientSummary.map(ps => (
                      <TableRow key={ps.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setFilterPatient(ps.id)}>
                        <TableCell className="font-medium">{ps.name}</TableCell>
                        <TableCell className="text-right">{ps.sessionsCount}</TableCell>
                        <TableCell className="text-right text-success">{formatCurrency(ps.received)}</TableCell>
                        <TableCell className="text-right">
                          {ps.pending > 0 ? (
                            <Badge variant="outline" className="text-warning border-warning">{formatCurrency(ps.pending)}</Badge>
                          ) : (
                            <Badge variant="secondary">Quitado</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground">
                Sem dados no período
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Baixa Dialog */}
      <Dialog open={!!baixaSession} onOpenChange={(open) => !open && setBaixaSession(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dar Baixa no Pagamento</DialogTitle>
          </DialogHeader>
          {baixaSession && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                <p><strong>Paciente:</strong> {getPatientName(baixaSession.patientId)}</p>
                <p><strong>Data da sessão:</strong> {formatDate(baixaSession.date)}</p>
                <p><strong>Valor previsto:</strong> {formatCurrency(baixaSession.expectedAmount)}</p>
                <p><strong>Já pago:</strong> {formatCurrency(baixaSession.paidAmount)}</p>
                <p><strong>Restante:</strong> {formatCurrency(baixaSession.expectedAmount - baixaSession.paidAmount)}</p>
              </div>
              <div>
                <Label>Valor a registrar (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={baixaAmount}
                  onChange={(e) => setBaixaAmount(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBaixaSession(null)}>Cancelar</Button>
            <Button onClick={handleBaixa} disabled={baixaLoading}>
              {baixaLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Confirmar Baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
