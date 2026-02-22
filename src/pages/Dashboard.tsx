import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchPatients, fetchPsychologists, fetchSessions } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { Users, Calendar, DollarSign, TrendingUp, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Patient, Psychologist, Session } from "@/types";

const CHART_COLORS = [
  "hsl(199, 89%, 38%)",
  "hsl(168, 60%, 42%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(270, 60%, 50%)",
];

export default function Dashboard() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [psychologists, setPsychologists] = useState<Psychologist[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchPatients(), fetchPsychologists(), fetchSessions()])
      .then(([p, psy, s]) => { setPatients(p); setPsychologists(psy); setSessions(s); })
      .finally(() => setLoading(false));
  }, []);

  const totalReceived = sessions.filter(s => s.paymentStatus === "paid").reduce((sum, s) => sum + s.paidAmount, 0);
  const totalPending = sessions.filter(s => s.paymentStatus === "pending").reduce((sum, s) => sum + s.expectedAmount, 0);
  const completedSessions = sessions.filter(s => s.status === "completed").length;
  const scheduledSessions = sessions.filter(s => s.status === "scheduled").length;

  const monthlyData = (() => {
    const months: Record<string, { received: number; expected: number }> = {};
    const now = new Date();
    for (let i = -2; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      months[key] = { received: 0, expected: 0 };
    }
    sessions.forEach(s => {
      const d = new Date(s.date);
      const key = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      if (months[key]) {
        if (s.paymentStatus === "paid") months[key].received += s.paidAmount;
        else months[key].expected += s.expectedAmount;
      }
    });
    return Object.entries(months).map(([month, data]) => ({ month, ...data }));
  })();

  const psychologistData = psychologists.map(p => {
    const psySessions = sessions.filter(s => s.psychologistId === p.id);
    const total = psySessions.reduce((sum, s) => sum + (s.paidAmount || s.expectedAmount), 0);
    return { name: p.name, value: total };
  }).filter(d => d.value > 0);

  if (loading) return (
    <div className="flex h-[50vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral da clínica</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pacientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{patients.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sessões Agendadas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{scheduledSessions}</div></CardContent>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">A Receber</CardTitle>
            <TrendingUp className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-warning">{formatCurrency(totalPending)}</div></CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Projeção Mensal</CardTitle></CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="received" name="Recebido" fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expected" name="Previsto" fill="hsl(199, 89%, 38%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground">
                Adicione sessões para ver a projeção
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Receita por Psicólogo</CardTitle></CardHeader>
          <CardContent>
            {psychologistData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={psychologistData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name }) => name}>
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
      </div>
    </div>
  );
}
