import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getPersonalExpenses, savePersonalExpense, updatePersonalExpense, deletePersonalExpense,
  getBankAccounts, saveBankAccount, deleteBankAccount,
} from "@/lib/store";
import { formatCurrency, formatDate, EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/format";
import { Plus, Trash2, ArrowUpCircle, ArrowDownCircle, Wallet, CreditCard, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { PersonalExpense } from "@/types";

export default function PersonalFinances() {
  const [expenses, setExpenses] = useState(getPersonalExpenses);
  const [accounts, setAccounts] = useState(getBankAccounts);
  const [expDialogOpen, setExpDialogOpen] = useState(false);
  const [accDialogOpen, setAccDialogOpen] = useState(false);

  const [expForm, setExpForm] = useState({
    description: "", amount: "", category: "", date: "", type: "expense" as "expense" | "income",
    paymentMethod: "", paid: false,
  });
  const [accForm, setAccForm] = useState({ name: "", balance: "", type: "checking" as "checking" | "savings" | "credit_card" });

  const totalIncome = expenses.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const totalExpenses = expenses.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const totalAccounts = accounts.reduce((s, a) => s + (a.type === "credit_card" ? -a.balance : a.balance), 0);

  function saveExp() {
    if (!expForm.description || !expForm.amount) { toast.error("Preencha os campos"); return; }
    savePersonalExpense({ ...expForm, amount: parseFloat(expForm.amount) });
    setExpenses(getPersonalExpenses());
    setExpDialogOpen(false);
    setExpForm({ description: "", amount: "", category: "", date: "", type: "expense", paymentMethod: "", paid: false });
    toast.success("Lançamento registrado");
  }

  function saveAcc() {
    if (!accForm.name) { toast.error("Nome da conta é obrigatório"); return; }
    saveBankAccount({ ...accForm, balance: parseFloat(accForm.balance) || 0 });
    setAccounts(getBankAccounts());
    setAccDialogOpen(false);
    setAccForm({ name: "", balance: "", type: "checking" });
    toast.success("Conta cadastrada");
  }

  function togglePaid(e: PersonalExpense) {
    updatePersonalExpense(e.id, { paid: !e.paid });
    setExpenses(getPersonalExpenses());
  }

  const accountTypeLabels: Record<string, string> = { checking: "Corrente", savings: "Poupança", credit_card: "Cartão de Crédito" };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finanças Pessoais</h1>
        <p className="text-muted-foreground">Controle suas finanças pessoais</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-success">{formatCurrency(totalIncome)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{formatCurrency(totalExpenses)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Contas</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(totalAccounts)}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Lançamentos</TabsTrigger>
          <TabsTrigger value="accounts">Contas</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={expDialogOpen} onOpenChange={setExpDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Novo Lançamento</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={expForm.type} onValueChange={v => setExpForm(f => ({ ...f, type: v as "expense" | "income" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="income">Receita</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Descrição *</Label>
                    <Input value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Valor *</Label>
                      <Input type="number" value={expForm.amount} onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Data</Label>
                      <Input type="date" value={expForm.date} onChange={e => setExpForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Categoria</Label>
                      <Select value={expForm.category} onValueChange={v => setExpForm(f => ({ ...f, category: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {EXPENSE_CATEGORIES.map(c => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Forma de Pagamento</Label>
                      <Select value={expForm.paymentMethod} onValueChange={v => setExpForm(f => ({ ...f, paymentMethod: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map(m => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button onClick={saveExp} className="w-full">Salvar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhum lançamento
                      </TableCell>
                    </TableRow>
                  ) : expenses.map(e => (
                    <TableRow key={e.id}>
                      <TableCell>{e.date ? formatDate(e.date) : "—"}</TableCell>
                      <TableCell className="font-medium">{e.description}</TableCell>
                      <TableCell>{e.category || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={e.type === "income" ? "default" : "secondary"}
                          className={e.type === "income" ? "bg-success text-success-foreground" : ""}>
                          {e.type === "income" ? "Receita" : "Despesa"}
                        </Badge>
                      </TableCell>
                      <TableCell className={e.type === "income" ? "text-success font-medium" : "text-destructive font-medium"}>
                        {e.type === "income" ? "+" : "-"}{formatCurrency(e.amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={e.paid ? "default" : "outline"} className={e.paid ? "bg-success text-success-foreground" : ""}>
                          {e.paid ? "Pago" : "Pendente"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => togglePaid(e)} title={e.paid ? "Marcar pendente" : "Marcar pago"}>
                            <CheckCircle className={`h-4 w-4 ${e.paid ? "text-success" : "text-muted-foreground"}`} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { deletePersonalExpense(e.id); setExpenses(getPersonalExpenses()); toast.success("Removido"); }}>
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
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={accDialogOpen} onOpenChange={setAccDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Nova Conta</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nova Conta</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Nome *</Label>
                    <Input value={accForm.name} onChange={e => setAccForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo</Label>
                      <Select value={accForm.type} onValueChange={v => setAccForm(f => ({ ...f, type: v as any }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="checking">Corrente</SelectItem>
                          <SelectItem value="savings">Poupança</SelectItem>
                          <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Saldo</Label>
                      <Input type="number" value={accForm.balance} onChange={e => setAccForm(f => ({ ...f, balance: e.target.value }))} />
                    </div>
                  </div>
                  <Button onClick={saveAcc} className="w-full">Cadastrar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.length === 0 ? (
              <p className="text-muted-foreground col-span-full text-center py-8">Nenhuma conta cadastrada</p>
            ) : accounts.map(a => (
              <Card key={a.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    {a.type === "credit_card" ? <CreditCard className="h-5 w-5 text-warning" /> : <Wallet className="h-5 w-5 text-primary" />}
                    <CardTitle className="text-sm font-medium">{a.name}</CardTitle>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { deleteBankAccount(a.id); setAccounts(getBankAccounts()); toast.success("Conta removida"); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary" className="mb-2">{accountTypeLabels[a.type]}</Badge>
                  <div className={`text-2xl font-bold ${a.type === "credit_card" ? "text-destructive" : ""}`}>
                    {a.type === "credit_card" ? "-" : ""}{formatCurrency(a.balance)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
