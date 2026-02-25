import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PatientCombobox } from "@/components/PatientCombobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fetchSessions, fetchPatients, fetchPsychologists } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { Loader2, TrendingUp, DollarSign, Users, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Session, Patient, Psychologist } from "@/types";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = ["hsl(199, 89%, 38%)", "hsl(168, 60%, 42%)", "hsl(38, 92%, 50%)", "hsl(0, 72%, 51%)", "hsl(270, 60%, 50%)", "hsl(330, 60%, 50%)"];

export default function Reports() {
  const { isAdmin } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPsy, setFilterPsy] = useState("all");
  const [filterPatient, setFilterPatient] = useState("all");
  const [period, setPeriod] = useState("month");

  useEffect(() => {
    Promise.all([fetchSessions(), fetchPatients(), fetchPsychologists()])
      .then(([s, p, psy]) => { setSessions(s); setPatients(p); setPsychologists(psy); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      const matchPsy = filterPsy === "all" || s.psychologistId === filterPsy;
      const matchPat = filterPatient === "all" || s.patientId === filterPatient;
      return matchPsy && matchPat;
    });
  }, [sessions, filterPsy, filterPatient]);

  // Summary stats
  const totalReceived = filtered.filter(s => s.paymentStatus === "paid").reduce((sum, s) => sum + s.paidAmount, 0);
  const totalPending = filtered.filter(s => s.paymentStatus !== "paid").reduce((sum, s) => sum + (s.expectedAmount - s.paidAmount), 0);
  const totalExpected = filtered.reduce((sum, s) => sum + s.expectedAmount, 0);
  const totalSessions = filtered.length;
  const completedSessions = filtered.filter(s => s.status === "completed").length;

  // Monthly data
  const monthlyData = useMemo(() => {
    const months: Record<string, { received: number; expected: number; pending: number; count: number }> = {};
    const now = new Date();
    for (let i = -5; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      months[key] = { received: 0, expected: 0, pending: 0, count: 0 };
    }
    filtered.forEach(s => {
      const d = new Date(s.date);
      const key = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      if (months[key]) {
        months[key].expected += s.expectedAmount;
        months[key].count++;
        if (s.paymentStatus === "paid") months[key].received += s.paidAmount;
        else months[key].pending += s.expectedAmount - s.paidAmount;
      }
    });
    return Object.entries(months).map(([month, data]) => ({ month, ...data }));
  }, [filtered]);

  // Weekly data (current month)
  const weeklyData = useMemo(() => {
    const now = new Date();
    const weeks: { week: string; received: number; expected: number; count: number }[] = [];
    for (let w = 0; w < 5; w++) {
      const start = new Date(now.getFullYear(), now.getMonth(), 1 + w * 7);
      const end = new Date(now.getFullYear(), now.getMonth(), Math.min(7 + w * 7, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()));
      const weekSessions = filtered.filter(s => {
        const d = new Date(s.date);
        return d >= start && d <= end;
      });
      weeks.push({
        week: `Sem ${w + 1}`,
        received: weekSessions.filter(s => s.paymentStatus === "paid").reduce((sum, s) => sum + s.paidAmount, 0),
        expected: weekSessions.reduce((sum, s) => sum + s.expectedAmount, 0),
        count: weekSessions.length,
      });
    }
    return weeks;
  }, [filtered]);

  // Per psychologist
  const psyData = useMemo(() => {
    return psychologists.map(p => {
      const psySessions = filtered.filter(s => s.psychologistId === p.id);
      return {
        name: p.name,
        received: psySessions.filter(s => s.paymentStatus === "paid").reduce((sum, s) => sum + s.paidAmount, 0),
        pending: psySessions.filter(s => s.paymentStatus !== "paid").reduce((sum, s) => sum + (s.expectedAmount - s.paidAmount), 0),
        sessions: psySessions.length,
        patients: new Set(psySessions.map(s => s.patientId)).size,
      };
    }).filter(d => d.sessions > 0);
  }, [filtered, psychologists]);

  // Per patient
  const patientData = useMemo(() => {
    return patients.map(p => {
      const patSessions = filtered.filter(s => s.patientId === p.id);
      return {
        id: p.id,
        name: p.name,
        psychologist: psychologists.find(psy => psy.id === p.psychologistId)?.name || "—",
        received: patSessions.filter(s => s.paymentStatus === "paid").reduce((sum, s) => sum + s.paidAmount, 0),
        pending: patSessions.filter(s => s.paymentStatus !== "paid").reduce((sum, s) => sum + (s.expectedAmount - s.paidAmount), 0),
        total: patSessions.reduce((sum, s) => sum + s.expectedAmount, 0),
        sessions: patSessions.length,
        completed: patSessions.filter(s => s.status === "completed").length,
      };
    }).filter(d => d.sessions > 0).sort((a, b) => b.total - a.total);
  }, [filtered, patients, psychologists]);

  const getPatientName = (id: string) => patients.find(p => p.id === id)?.name || "—";
  const getPsyName = (id: string) => psychologists.find(p => p.id === id)?.name || "—";

  if (loading) return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios Financeiros</h1>
          <p className="text-muted-foreground">Visão detalhada das finanças da clínica</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <Select value={filterPsy} onValueChange={setFilterPsy}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Psicólogo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Psicólogos</SelectItem>
                {psychologists.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
              </SelectContent>
            </Select>
          )}
          <PatientCombobox
            options={patients.map(p => ({ value: p.id, label: p.name }))}
            value={filterPatient}
            onValueChange={setFilterPatient}
            showAll
            allLabel="Todos Pacientes"
            className="w-[180px]"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Previsto</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold">{formatCurrency(totalExpected)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Recebido</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-green-600">{formatCurrency(totalReceived)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pendente</CardTitle>
            <DollarSign className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold text-amber-600">{formatCurrency(totalPending)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Sessões</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold">{completedSessions}/{totalSessions}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Taxa Pgto</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold">{totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0}%</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="monthly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monthly">Mensal</TabsTrigger>
          <TabsTrigger value="weekly">Semanal</TabsTrigger>
          <TabsTrigger value="psychologist">Por Psicólogo</TabsTrigger>
          <TabsTrigger value="patient">Por Paciente</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <Card>
            <CardHeader><CardTitle className="text-base">Projeção Mensal (6 meses + 3 futuros)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="received" name="Recebido" fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" name="Pendente" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekly">
          <Card>
            <CardHeader><CardTitle className="text-base">Visão Semanal (Mês Atual)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="week" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v: number, name: string) => [name === "count" ? v : formatCurrency(v as number), name === "count" ? "Sessões" : name === "received" ? "Recebido" : "Previsto"]} />
                  <Bar dataKey="expected" name="Previsto" fill="hsl(199, 89%, 38%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="received" name="Recebido" fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="psychologist">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Receita por Psicólogo</CardTitle></CardHeader>
              <CardContent>
                {psyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={psyData.map(d => ({ name: d.name, value: d.received + d.pending }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name }) => name}>
                        {psyData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-center text-muted-foreground py-8">Sem dados</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Detalhamento</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Psicólogo</TableHead><TableHead>Sessões</TableHead>
                      <TableHead>Pacientes</TableHead><TableHead>Recebido</TableHead><TableHead>Pendente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {psyData.map(d => (
                      <TableRow key={d.name}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell>{d.sessions}</TableCell>
                        <TableCell>{d.patients}</TableCell>
                        <TableCell className="text-green-600">{formatCurrency(d.received)}</TableCell>
                        <TableCell className="text-amber-600">{formatCurrency(d.pending)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="patient">
          <Card>
            <CardHeader><CardTitle className="text-base">Relatório por Paciente</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead><TableHead>Psicólogo</TableHead>
                    <TableHead>Sessões</TableHead><TableHead>Realizadas</TableHead>
                    <TableHead>Total Previsto</TableHead><TableHead>Recebido</TableHead><TableHead>Pendente</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patientData.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem dados</TableCell></TableRow>
                  ) : patientData.map(d => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>{d.psychologist}</TableCell>
                      <TableCell>{d.sessions}</TableCell>
                      <TableCell>{d.completed}</TableCell>
                      <TableCell>{formatCurrency(d.total)}</TableCell>
                      <TableCell className="text-green-600 font-medium">{formatCurrency(d.received)}</TableCell>
                      <TableCell className="text-amber-600 font-medium">{formatCurrency(d.pending)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
