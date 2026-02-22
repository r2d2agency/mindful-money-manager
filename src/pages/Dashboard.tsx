import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fetchPatients, fetchPsychologists, fetchSessions } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { Users, Calendar, DollarSign, TrendingUp, Loader2, BarChart3, User } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { Patient, Psychologist, Session } from "@/types";

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

export default function Dashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPatient, setFilterPatient] = useState("all");

  useEffect(() => {
    Promise.all([fetchPatients(), fetchPsychologists(), fetchSessions()])
      .then(([p, psy, s]) => { setPatients(p); setPsychologists(psy); setSessions(s); })
      .finally(() => setLoading(false));
  }, []);

  const filteredSessions = useMemo(() => {
    if (filterPatient === "all") return sessions;
    return sessions.filter(s => s.patientId === filterPatient);
  }, [sessions, filterPatient]);

  const totalReceived = filteredSessions.filter(s => s.paymentStatus === "paid").reduce((sum, s) => sum + s.paidAmount, 0);
  const totalPending = filteredSessions.filter(s => s.paymentStatus !== "paid" && s.status !== "cancelled").reduce((sum, s) => sum + s.expectedAmount - s.paidAmount, 0);
  const completedSessions = filteredSessions.filter(s => s.status === "completed").length;
  const scheduledSessions = filteredSessions.filter(s => s.status === "scheduled").length;
  const totalSessions = filteredSessions.filter(s => s.status !== "cancelled").length;

  // Monthly projection data (6 months back, 6 months forward)
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
    sessions.filter(s => s.status !== "cancelled").forEach(s => {
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
  }, [sessions, patients]);

  // Revenue by psychologist
  const psychologistData = useMemo(() => {
    return psychologists.map(p => {
      const psySessions = filteredSessions.filter(s => s.psychologistId === p.id && s.status !== "cancelled");
      const received = psySessions.filter(s => s.paymentStatus === "paid").reduce((sum, s) => sum + s.paidAmount, 0);
      const pending = psySessions.filter(s => s.paymentStatus !== "paid").reduce((sum, s) => sum + s.expectedAmount - s.paidAmount, 0);
      return { name: p.name, received, pending, total: received + pending };
    }).filter(d => d.total > 0);
  }, [filteredSessions, psychologists]);

  // Monthly line chart for cumulative projection
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

  if (loading) return (
    <div className="flex h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            {selectedPatientName ? `Visão financeira — ${selectedPatientName}` : "Visão geral da clínica"}
          </p>
        </div>
        <Select value={filterPatient} onValueChange={setFilterPatient}>
          <SelectTrigger className="w-[240px]">
            <User className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Todos os Pacientes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Pacientes</SelectItem>
            {patients.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Sessões</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSessions}</div>
            <p className="text-xs text-muted-foreground">{completedSessions} realizadas · {scheduledSessions} agendadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pacientes Ativos</CardTitle>
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
                Adicione psicólogos e sessões para ver o gráfico
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
                Adicione sessões para ver o resumo
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
