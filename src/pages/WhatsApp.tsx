import { useState, useEffect, useMemo, useRef } from "react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { formatDate } from "@/lib/format";
import {
  MessageSquare, QrCode, Plus, Trash2, RefreshCw, Send, Loader2,
  CheckCircle, XCircle, Clock, AlertTriangle, Wifi, WifiOff, Eye, RotateCcw,
  Upload, Mic, FileText, Image, Video, Calendar as CalendarIcon, List, Play, Pencil
} from "lucide-react";
import {
  fetchWhatsAppInstances, createWhatsAppInstance, deleteWhatsAppInstance,
  getWhatsAppQRCode, getWhatsAppStatus, restartWhatsAppInstance, disconnectWhatsAppInstance,
  fetchWhatsAppTemplates, createWhatsAppTemplate, updateWhatsAppTemplate, deleteWhatsAppTemplate,
  fetchWhatsAppLogs, resendWhatsAppMessage, sendWhatsAppBilling, sendWhatsAppMulti,
  fetchPatients, fetchScheduledBillings, updateScheduledBilling, sendScheduledBillingNow, generateScheduledBillings
} from "@/lib/api";

interface WaInstance {
  id: string; instance_name: string; instance_id: string;
  status: string; connected_phone: string; created_at: string;
}
interface WaTemplate {
  id: string; name: string; message: string; type: string;
  media_url: string; active: boolean; created_at: string;
}
interface WaLog {
  id: string; patient_name: string; template_name: string; instance_name: string;
  phone: string; message: string; type: string; status: string;
  error_message: string; sent_at: string; created_at: string;
}
interface MessageStep {
  type: "text" | "image" | "audio" | "video" | "document";
  message: string;
  mediaBase64: string;
  mediaFileName: string;
  delayAfter: number;
  simulateTyping: boolean;
}

export default function WhatsApp() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("connection");

  // Instances
  const [instances, setInstances] = useState<WaInstance[]>([]);
  const [showNewInstance, setShowNewInstance] = useState(false);
  const [newName, setNewName] = useState("");
  const [globalToken, setGlobalToken] = useState("");
  const [autoCreate, setAutoCreate] = useState(true);
  const [rejectCalls, setRejectCalls] = useState(true);
  const [callMessage, setCallMessage] = useState("Não estamos disponíveis no momento.");
  const [manualInstanceId, setManualInstanceId] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrInstanceId, setQrInstanceId] = useState<string | null>(null);

  // Templates
  const [templates, setTemplates] = useState<WaTemplate[]>([]);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplMessage, setTplMessage] = useState("");
  const [tplType, setTplType] = useState("text");
  const [tplMediaUrl, setTplMediaUrl] = useState("");

  // Logs
  const [logs, setLogs] = useState<WaLog[]>([]);
  const [logFilter, setLogFilter] = useState("all");

  // Billing (legacy)
  const [showBilling, setShowBilling] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [billingInstanceId, setBillingInstanceId] = useState("");
  const [billingTemplateId, setBillingTemplateId] = useState("");
  const [sendingBilling, setSendingBilling] = useState(false);

  // Multi-message composer
  const [showComposer, setShowComposer] = useState(false);
  const [composerPhone, setComposerPhone] = useState("");
  const [composerInstanceId, setComposerInstanceId] = useState("");
  const [composerPatientId, setComposerPatientId] = useState("");
  const [composerSteps, setComposerSteps] = useState<MessageStep[]>([
    { type: "text", message: "", mediaBase64: "", mediaFileName: "", delayAfter: 3, simulateTyping: true }
  ]);
  const [sendingComposer, setSendingComposer] = useState(false);
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Scheduled billings
  const [scheduledBillings, setScheduledBillings] = useState<any[]>([]);
  const [scheduledView, setScheduledView] = useState<"list" | "calendar">("list");
  const [editingBilling, setEditingBilling] = useState<any>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  useEffect(() => {
    loadInstances();
    loadTemplates();
    loadLogs();
    fetchPatients().then(setPatients).catch(() => {});
    loadScheduledBillings();
  }, []);

  async function loadInstances() { try { setInstances(await fetchWhatsAppInstances()); } catch {} }
  async function loadTemplates() { try { setTemplates(await fetchWhatsAppTemplates()); } catch {} }
  async function loadLogs() { try { setLogs(await fetchWhatsAppLogs()); } catch {} }
  async function loadScheduledBillings() { try { setScheduledBillings(await fetchScheduledBillings()); } catch {} }

  // --- Instance handlers ---
  async function handleCreateInstance() {
    if (!newName) return toast.error("Preencha o nome da conexão");
    if (autoCreate && !globalToken) return toast.error("Token global é obrigatório");
    if (!autoCreate && (!manualInstanceId || !manualToken)) return toast.error("Preencha Instance ID e Token");
    setCreatingInstance(true);
    try {
      await createWhatsAppInstance({ instanceName: newName, globalToken, autoCreate, rejectCalls, callMessage, manualInstanceId, manualToken });
      toast.success("Instância criada!");
      setShowNewInstance(false);
      setNewName(""); setGlobalToken(""); setManualInstanceId(""); setManualToken("");
      loadInstances();
    } catch (err: any) { toast.error(err.message); }
    setCreatingInstance(false);
  }

  async function handleGetQR(id: string) {
    setQrLoading(true); setQrInstanceId(id); setQrCode(null);
    try {
      const data = await getWhatsAppQRCode(id);
      const qr = data.qrcode || data.base64;
      if (qr) { setQrCode(qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`); }
      else { toast.error("QR code não disponível"); }
    } catch (err: any) { toast.error(err.message); }
    setQrLoading(false);
  }

  async function handleCheckStatus(id: string) {
    try { const data = await getWhatsAppStatus(id); toast.success(data.connected ? "Conectado!" : "Desconectado"); loadInstances(); }
    catch (err: any) { toast.error(err.message); }
  }

  async function handleRestart(id: string) {
    try { await restartWhatsAppInstance(id); toast.success("Reiniciada!"); loadInstances(); } catch (err: any) { toast.error(err.message); }
  }

  async function handleDisconnect(id: string) {
    if (!confirm("Desconectar?")) return;
    try { await disconnectWhatsAppInstance(id); toast.success("Desconectada!"); loadInstances(); } catch (err: any) { toast.error(err.message); }
  }

  async function handleDeleteInstance(id: string) {
    if (!confirm("Tem certeza?")) return;
    try { await deleteWhatsAppInstance(id); loadInstances(); toast.success("Removida"); } catch (err: any) { toast.error(err.message); }
  }

  // --- Template handlers ---
  async function handleCreateTemplate() {
    if (!tplName || !tplMessage) return toast.error("Preencha nome e mensagem");
    try {
      await createWhatsAppTemplate({ name: tplName, message: tplMessage, type: tplType, mediaUrl: tplMediaUrl });
      toast.success("Template criado!"); setShowNewTemplate(false);
      setTplName(""); setTplMessage(""); setTplType("text"); setTplMediaUrl("");
      loadTemplates();
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm("Tem certeza?")) return;
    try { await deleteWhatsAppTemplate(id); loadTemplates(); toast.success("Removido"); } catch (err: any) { toast.error(err.message); }
  }

  async function handleResend(id: string) {
    try { await resendWhatsAppMessage(id); toast.success("Reenviado!"); loadLogs(); } catch (err: any) { toast.error(err.message); }
  }

  // --- Billing handlers ---
  async function handleSendBilling() {
    if (!billingInstanceId || !billingTemplateId || !selectedPatients.length) return toast.error("Selecione instância, template e pacientes");
    setSendingBilling(true);
    try {
      const data = await sendWhatsAppBilling({ instanceId: billingInstanceId, templateId: billingTemplateId, patientIds: selectedPatients });
      const ok = data.results?.filter((r: any) => r.success).length || 0;
      const fail = data.results?.filter((r: any) => !r.success).length || 0;
      toast.success(`Enviados: ${ok} | Falhas: ${fail}`);
      setShowBilling(false); setSelectedPatients([]);
      loadLogs();
    } catch (err: any) { toast.error(err.message); }
    setSendingBilling(false);
  }

  // --- Multi-message composer ---
  function addStep() {
    setComposerSteps(prev => [...prev, { type: "text", message: "", mediaBase64: "", mediaFileName: "", delayAfter: 3, simulateTyping: true }]);
  }

  function removeStep(i: number) {
    setComposerSteps(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateStep(i: number, field: keyof MessageStep, value: any) {
    setComposerSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }

  function handleFileUpload(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Arquivo máximo: 10MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      updateStep(i, "mediaBase64", reader.result as string);
      updateStep(i, "mediaFileName", file.name);
    };
    reader.readAsDataURL(file);
  }

  async function handleSendComposer() {
    if (!composerInstanceId || !composerPhone) return toast.error("Selecione instância e telefone");
    if (!composerSteps.length) return toast.error("Adicione pelo menos uma mensagem");
    setSendingComposer(true);
    try {
      const data = await sendWhatsAppMulti({
        instanceId: composerInstanceId,
        phone: composerPhone,
        patientId: composerPatientId || undefined,
        messages: composerSteps.map(s => ({
          type: s.type,
          message: s.message,
          mediaBase64: s.mediaBase64,
          delayAfter: s.delayAfter,
          simulateTyping: s.simulateTyping,
        })),
      });
      const ok = data.results?.filter((r: any) => r.success).length || 0;
      toast.success(`${ok}/${composerSteps.length} mensagens enviadas!`);
      setShowComposer(false);
      loadLogs();
    } catch (err: any) { toast.error(err.message); }
    setSendingComposer(false);
  }

  // --- Scheduled billings ---
  async function handleGenerateScheduled() {
    try {
      const data = await generateScheduledBillings();
      toast.success(`${data.created} cobranças agendadas criadas`);
      loadScheduledBillings();
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleSendNow(id: string) {
    try { await sendScheduledBillingNow(id); toast.success("Enviada!"); loadScheduledBillings(); }
    catch (err: any) { toast.error(err.message); }
  }

  async function handleSaveScheduledEdit() {
    if (!editingBilling) return;
    try {
      await updateScheduledBilling(editingBilling.id, {
        scheduledDate: editingBilling.scheduled_date,
        notes: editingBilling.notes,
        status: editingBilling.status,
      });
      toast.success("Atualizado!");
      setEditingBilling(null);
      loadScheduledBillings();
    } catch (err: any) { toast.error(err.message); }
  }

  const filteredLogs = useMemo(() => {
    if (logFilter === "all") return logs;
    return logs.filter(l => l.status === logFilter);
  }, [logs, logFilter]);

  const connectedInstances = instances.filter(i => i.status === "connected");

  const variablesHelp = "{nome} = apelido do paciente\n{sessoes} = nº sessões pendentes\n{valor_sessao} = valor médio por sessão\n{valor_total} = valor total devido";

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [calendarMonth]);

  const getBillingsForDay = (day: number) => {
    const dateStr = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return scheduledBillings.filter(b => b.scheduled_date === dateStr);
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "image": return <Image className="h-4 w-4" />;
      case "audio": return <Mic className="h-4 w-4" />;
      case "video": return <Video className="h-4 w-4" />;
      case "document": return <FileText className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const fileAccept = (type: string) => {
    switch (type) {
      case "image": return "image/*";
      case "audio": return "audio/*";
      case "video": return "video/*";
      case "document": return ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";
      default: return "*";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="h-6 w-6" /> WhatsApp</h1>
          <p className="text-muted-foreground text-sm">Gerenciamento de conexão, templates e envios</p>
        </div>
        <Button onClick={() => setShowComposer(true)} disabled={!connectedInstances.length}>
          <Plus className="h-4 w-4 mr-1" /> Nova Mensagem
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="connection"><Wifi className="h-4 w-4 mr-1" /> Conexão</TabsTrigger>
          <TabsTrigger value="templates"><MessageSquare className="h-4 w-4 mr-1" /> Templates</TabsTrigger>
          <TabsTrigger value="billing"><Send className="h-4 w-4 mr-1" /> Cobranças</TabsTrigger>
          <TabsTrigger value="scheduled"><CalendarIcon className="h-4 w-4 mr-1" /> Agendadas</TabsTrigger>
          <TabsTrigger value="logs"><Eye className="h-4 w-4 mr-1" /> Logs</TabsTrigger>
        </TabsList>

        {/* ===== CONEXÃO ===== */}
        <TabsContent value="connection" className="space-y-4">
          {isAdmin && (
            <Button onClick={() => setShowNewInstance(true)}><Plus className="h-4 w-4 mr-1" /> Nova Instância</Button>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {instances.map(inst => (
              <Card key={inst.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{inst.instance_name}</CardTitle>
                    <Badge variant={inst.status === "connected" ? "default" : "secondary"}>
                      {inst.status === "connected" ? <><Wifi className="h-3 w-3 mr-1" />Conectado</> :
                       inst.status === "pending" ? <><Clock className="h-3 w-3 mr-1" />Aguardando</> :
                       <><WifiOff className="h-3 w-3 mr-1" />Desconectado</>}
                    </Badge>
                  </div>
                  {inst.connected_phone && <CardDescription>📱 {inst.connected_phone}</CardDescription>}
                </CardHeader>
                <CardContent className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => handleGetQR(inst.id)}><QrCode className="h-4 w-4 mr-1" /> QR</Button>
                  <Button size="sm" variant="outline" onClick={() => handleCheckStatus(inst.id)}><RefreshCw className="h-4 w-4 mr-1" /> Status</Button>
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleRestart(inst.id)}><RotateCcw className="h-4 w-4 mr-1" /> Reiniciar</Button>
                      {inst.status === "connected" && (
                        <Button size="sm" variant="secondary" onClick={() => handleDisconnect(inst.id)}><WifiOff className="h-4 w-4 mr-1" /> Desconectar</Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteInstance(inst.id)}><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
            {!instances.length && <p className="text-muted-foreground col-span-full text-center py-8">Nenhuma instância cadastrada</p>}
          </div>

          {/* QR Code modal */}
          <Dialog open={!!qrCode || qrLoading} onOpenChange={() => { setQrCode(null); setQrLoading(false); }}>
            <DialogContent>
              <DialogHeader><DialogTitle>QR Code WhatsApp</DialogTitle></DialogHeader>
              <div className="flex justify-center py-4">
                {qrLoading ? <Loader2 className="h-12 w-12 animate-spin" /> :
                 qrCode ? <img src={qrCode} alt="QR Code" className="max-w-[280px]" /> :
                 <p>QR code não disponível</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => qrInstanceId && handleGetQR(qrInstanceId)}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* New instance dialog */}
          <Dialog open={showNewInstance} onOpenChange={setShowNewInstance}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Nova Conexão WhatsApp</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="WhatsApp Principal" /></div>
                <div className="flex items-center justify-between border rounded-md p-3">
                  <div><p className="font-medium text-sm">Criar automaticamente</p></div>
                  <Switch checked={autoCreate} onCheckedChange={setAutoCreate} />
                </div>
                <div className="flex items-center justify-between border rounded-md p-3">
                  <p className="font-medium text-sm">Rejeitar chamadas</p>
                  <Switch checked={rejectCalls} onCheckedChange={setRejectCalls} />
                </div>
                {rejectCalls && <div><Label>Mensagem de rejeição</Label><Textarea value={callMessage} onChange={e => setCallMessage(e.target.value)} rows={2} /></div>}
                {autoCreate ? (
                  <div><Label>Token Global</Label><Input value={globalToken} onChange={e => setGlobalToken(e.target.value)} type="password" /></div>
                ) : (
                  <>
                    <div><Label>Instance ID</Label><Input value={manualInstanceId} onChange={e => setManualInstanceId(e.target.value)} /></div>
                    <div><Label>Token</Label><Input value={manualToken} onChange={e => setManualToken(e.target.value)} type="password" /></div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewInstance(false)}>Cancelar</Button>
                <Button onClick={handleCreateInstance} disabled={creatingInstance}>
                  {creatingInstance && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===== TEMPLATES ===== */}
        <TabsContent value="templates" className="space-y-4">
          {isAdmin && <Button onClick={() => setShowNewTemplate(true)}><Plus className="h-4 w-4 mr-1" /> Novo Template</Button>}
          <div className="bg-muted/50 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap">{variablesHelp}</div>
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map(t => (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <Badge variant="outline">{t.type}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap mb-3">{t.message}</p>
                  {isAdmin && <Button size="sm" variant="destructive" onClick={() => handleDeleteTemplate(t.id)}><Trash2 className="h-4 w-4 mr-1" /> Remover</Button>}
                </CardContent>
              </Card>
            ))}
          </div>
          <Dialog open={showNewTemplate} onOpenChange={setShowNewTemplate}>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Template</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome</Label><Input value={tplName} onChange={e => setTplName(e.target.value)} /></div>
                <div><Label>Tipo</Label>
                  <Select value={tplType} onValueChange={setTplType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="audio">Áudio</SelectItem>
                      <SelectItem value="document">Documento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Mensagem</Label><Textarea value={tplMessage} onChange={e => setTplMessage(e.target.value)} rows={4} /></div>
              </div>
              <DialogFooter><Button onClick={handleCreateTemplate}><Plus className="h-4 w-4 mr-1" /> Criar</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===== COBRANÇAS EM LOTE ===== */}
        <TabsContent value="billing" className="space-y-4">
          <Button onClick={() => setShowBilling(true)} disabled={!connectedInstances.length || !templates.length}>
            <Send className="h-4 w-4 mr-1" /> Enviar Cobranças
          </Button>
          {!connectedInstances.length && <p className="text-sm text-muted-foreground">⚠️ Conecte uma instância primeiro</p>}

          <Dialog open={showBilling} onOpenChange={setShowBilling}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Enviar Cobranças em Lote</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Instância</Label>
                  <Select value={billingInstanceId} onValueChange={setBillingInstanceId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{connectedInstances.map(i => <SelectItem key={i.id} value={i.id}>{i.instance_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Template</Label>
                  <Select value={billingTemplateId} onValueChange={setBillingTemplateId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>{templates.filter(t => t.active).map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pacientes ({selectedPatients.length})</Label>
                  <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1 mt-1">
                    {patients.filter(p => p.phone).map(p => (
                      <label key={p.id} className="flex items-center gap-2 text-sm hover:bg-muted p-1 rounded cursor-pointer">
                        <Checkbox checked={selectedPatients.includes(p.id)} onCheckedChange={c => setSelectedPatients(prev => c ? [...prev, p.id] : prev.filter(x => x !== p.id))} />
                        <span>{p.name}</span>
                        <span className="text-muted-foreground text-xs ml-auto">{p.phone}</span>
                      </label>
                    ))}
                  </div>
                  <Button variant="link" size="sm" className="mt-1 p-0 h-auto" onClick={() => setSelectedPatients(patients.filter(p => p.phone).map(p => p.id))}>Selecionar todos</Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSendBilling} disabled={sendingBilling}>
                  {sendingBilling ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                  Enviar ({selectedPatients.length})
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===== COBRANÇAS AGENDADAS ===== */}
        <TabsContent value="scheduled" className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            {isAdmin && (
              <Button onClick={handleGenerateScheduled}><RefreshCw className="h-4 w-4 mr-1" /> Gerar Agendamentos</Button>
            )}
            <div className="flex border rounded-md overflow-hidden ml-auto">
              <Button variant={scheduledView === "list" ? "default" : "ghost"} size="sm" onClick={() => setScheduledView("list")} className="rounded-none">
                <List className="h-4 w-4 mr-1" /> Lista
              </Button>
              <Button variant={scheduledView === "calendar" ? "default" : "ghost"} size="sm" onClick={() => setScheduledView("calendar")} className="rounded-none">
                <CalendarIcon className="h-4 w-4 mr-1" /> Calendário
              </Button>
            </div>
          </div>

          {scheduledView === "list" ? (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scheduledBillings.map(b => (
                    <TableRow key={b.id}>
                      <TableCell>
                        {b.status === "sent" ? <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Enviada</Badge> :
                         b.status === "failed" ? <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falha</Badge> :
                         b.status === "cancelled" ? <Badge variant="secondary">Cancelada</Badge> :
                         <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>}
                      </TableCell>
                      <TableCell className="font-medium">{b.patient_name}</TableCell>
                      <TableCell>{formatDate(b.scheduled_date)}</TableCell>
                      <TableCell className="text-sm">{b.template_name || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setEditingBilling({ ...b })}><Pencil className="h-4 w-4" /></Button>
                          {b.status === "pending" && (
                            <Button size="sm" variant="ghost" onClick={() => handleSendNow(b.id)} title="Enviar agora">
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!scheduledBillings.length && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma cobrança agendada. Clique em "Gerar Agendamentos".</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* Calendar view */
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1))}>←</Button>
                  <CardTitle className="text-base">
                    {calendarMonth.toLocaleString("pt-BR", { month: "long", year: "numeric" })}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1))}>→</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 text-center text-xs">
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => <div key={d} className="font-medium text-muted-foreground p-1">{d}</div>)}
                  {calendarDays.map((day, i) => {
                    if (!day) return <div key={`e${i}`} />;
                    const dayBillings = getBillingsForDay(day);
                    return (
                      <div key={day} className={`p-1 min-h-[60px] border rounded text-left ${dayBillings.length ? "bg-primary/5" : ""}`}>
                        <span className="text-xs font-medium">{day}</span>
                        {dayBillings.map(b => (
                          <div
                            key={b.id}
                            onClick={() => setEditingBilling({ ...b })}
                            className={`text-[10px] rounded px-1 mt-0.5 truncate cursor-pointer ${
                              b.status === "sent" ? "bg-green-100 text-green-800" :
                              b.status === "failed" ? "bg-red-100 text-red-800" :
                              b.status === "cancelled" ? "bg-gray-100 text-gray-500" :
                              "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {b.patient_name?.split(" ")[0]}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Edit scheduled billing dialog */}
          <Dialog open={!!editingBilling} onOpenChange={o => !o && setEditingBilling(null)}>
            <DialogContent>
              <DialogHeader><DialogTitle>Editar Cobrança</DialogTitle></DialogHeader>
              {editingBilling && (
                <div className="space-y-4">
                  <div><Label>Paciente</Label><Input value={editingBilling.patient_name} disabled /></div>
                  <div><Label>Data</Label><Input type="date" value={editingBilling.scheduled_date} onChange={e => setEditingBilling({ ...editingBilling, scheduled_date: e.target.value })} /></div>
                  <div><Label>Status</Label>
                    <Select value={editingBilling.status} onValueChange={v => setEditingBilling({ ...editingBilling, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="cancelled">Cancelada</SelectItem>
                        <SelectItem value="sent">Enviada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Observações</Label><Textarea value={editingBilling.notes || ""} onChange={e => setEditingBilling({ ...editingBilling, notes: e.target.value })} rows={2} /></div>
                </div>
              )}
              <DialogFooter className="gap-2">
                {editingBilling?.status === "pending" && (
                  <Button variant="secondary" onClick={() => { handleSendNow(editingBilling.id); setEditingBilling(null); }}>
                    <Play className="h-4 w-4 mr-1" /> Enviar Agora
                  </Button>
                )}
                <Button onClick={handleSaveScheduledEdit}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===== LOGS ===== */}
        <TabsContent value="logs" className="space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <Button variant="outline" size="sm" onClick={loadLogs}><RefreshCw className="h-4 w-4 mr-1" /> Atualizar</Button>
            <Select value={logFilter} onValueChange={setLogFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
                <SelectItem value="failed">Falhas</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline">{filteredLogs.length} registros</Badge>
          </div>

          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map(l => (
                  <TableRow key={l.id}>
                    <TableCell>
                      {l.status === "sent" ? <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Enviado</Badge> :
                       l.status === "failed" ? <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falha</Badge> :
                       <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>}
                    </TableCell>
                    <TableCell className="font-medium">{l.patient_name || "—"}</TableCell>
                    <TableCell className="text-xs">{l.phone}</TableCell>
                    <TableCell><Badge variant="outline">{l.type}</Badge></TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">{l.message}</TableCell>
                    <TableCell className="text-xs">{formatDate(l.created_at)}</TableCell>
                    <TableCell>
                      {l.status === "failed" && (
                        <Button size="sm" variant="ghost" onClick={() => handleResend(l.id)}><RotateCcw className="h-4 w-4" /></Button>
                      )}
                      {l.error_message && <span className="text-xs text-destructive block max-w-[150px] truncate" title={l.error_message}>{l.error_message}</span>}
                    </TableCell>
                  </TableRow>
                ))}
                {!filteredLogs.length && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum registro</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== MULTI-MESSAGE COMPOSER DIALOG ===== */}
      <Dialog open={showComposer} onOpenChange={setShowComposer}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Construtor de Mensagens</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Instância</Label>
                <Select value={composerInstanceId} onValueChange={setComposerInstanceId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{connectedInstances.map(i => <SelectItem key={i.id} value={i.id}>{i.instance_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Paciente (opcional)</Label>
                <Select value={composerPatientId} onValueChange={v => {
                  setComposerPatientId(v);
                  const p = patients.find(p => p.id === v);
                  if (p?.phone) setComposerPhone(p.phone);
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>{patients.filter(p => p.phone).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={composerPhone} onChange={e => setComposerPhone(e.target.value)} placeholder="5511999999999" />
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Mensagens ({composerSteps.length})</Label>
              {composerSteps.map((step, i) => (
                <Card key={i} className="border-l-4 border-l-primary">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="gap-1">{typeIcon(step.type)} Msg {i + 1}</Badge>
                      {composerSteps.length > 1 && (
                        <Button size="sm" variant="ghost" onClick={() => removeStep(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Tipo</Label>
                        <Select value={step.type} onValueChange={v => updateStep(i, "type", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">📝 Texto</SelectItem>
                            <SelectItem value="image">🖼️ Imagem</SelectItem>
                            <SelectItem value="audio">🎤 Áudio</SelectItem>
                            <SelectItem value="video">🎬 Vídeo</SelectItem>
                            <SelectItem value="document">📄 Documento</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Esperar após (seg)</Label>
                        <Input type="number" min={0} value={step.delayAfter} onChange={e => updateStep(i, "delayAfter", parseInt(e.target.value) || 0)} />
                      </div>
                    </div>

                    {step.type !== "audio" && (
                      <div>
                        <Label className="text-xs">{step.type === "text" ? "Mensagem" : "Legenda"}</Label>
                        <Textarea value={step.message} onChange={e => updateStep(i, "message", e.target.value)} rows={2} placeholder="Digite a mensagem..." />
                      </div>
                    )}

                    {step.type !== "text" && (
                      <div>
                        <Label className="text-xs">Arquivo</Label>
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            ref={el => { fileInputRefs.current[i] = el; }}
                            className="hidden"
                            accept={fileAccept(step.type)}
                            onChange={e => handleFileUpload(i, e)}
                          />
                          <Button variant="outline" size="sm" onClick={() => fileInputRefs.current[i]?.click()}>
                            <Upload className="h-4 w-4 mr-1" /> Carregar Arquivo
                          </Button>
                          {step.mediaFileName && <span className="text-xs text-muted-foreground truncate max-w-[200px]">📎 {step.mediaFileName}</span>}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={step.simulateTyping} onCheckedChange={c => updateStep(i, "simulateTyping", !!c)} />
                        <Label className="text-xs cursor-pointer">
                          {step.type === "audio" ? "🎙️ Simular gravando áudio" : "⌨️ Simular digitando"}
                        </Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" className="w-full" onClick={addStep}><Plus className="h-4 w-4 mr-1" /> Adicionar Mensagem</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComposer(false)}>Cancelar</Button>
            <Button onClick={handleSendComposer} disabled={sendingComposer}>
              {sendingComposer ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Enviar {composerSteps.length} mensagem(ns)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
