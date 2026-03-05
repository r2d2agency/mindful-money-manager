import { useState, useEffect, useMemo } from "react";
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
  CheckCircle, XCircle, Clock, AlertTriangle, Wifi, WifiOff, Eye, RotateCcw
} from "lucide-react";
import {
  fetchWhatsAppInstances, createWhatsAppInstance, deleteWhatsAppInstance,
  getWhatsAppQRCode, getWhatsAppStatus, restartWhatsAppInstance, disconnectWhatsAppInstance,
  fetchWhatsAppTemplates, createWhatsAppTemplate, updateWhatsAppTemplate, deleteWhatsAppTemplate,
  fetchWhatsAppLogs, resendWhatsAppMessage, sendWhatsAppBilling,
  fetchPatients
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

  // Billing
  const [showBilling, setShowBilling] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [billingInstanceId, setBillingInstanceId] = useState("");
  const [billingTemplateId, setBillingTemplateId] = useState("");
  const [sendingBilling, setSendingBilling] = useState(false);

  useEffect(() => {
    loadInstances();
    loadTemplates();
    loadLogs();
    fetchPatients().then(setPatients).catch(() => {});
  }, []);

  async function loadInstances() {
    try { setInstances(await fetchWhatsAppInstances()); } catch { }
  }
  async function loadTemplates() {
    try { setTemplates(await fetchWhatsAppTemplates()); } catch { }
  }
  async function loadLogs() {
    try { setLogs(await fetchWhatsAppLogs()); } catch { }
  }

  async function handleCreateInstance() {
    if (!newName) return toast.error("Preencha o nome da conexão");
    if (autoCreate && !globalToken) return toast.error("Token global é obrigatório para criação automática");
    if (!autoCreate && (!manualInstanceId || !manualToken)) return toast.error("Preencha Instance ID e Token");
    setCreatingInstance(true);
    try {
      await createWhatsAppInstance({
        instanceName: newName, globalToken,
        autoCreate, rejectCalls, callMessage,
        manualInstanceId, manualToken,
      });
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
      if (qr) {
        // Handle both raw base64 and data URI formats
        setQrCode(qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`);
      } else {
        toast.error("QR code não disponível. Verifique se a instância já está conectada.");
      }
    } catch (err: any) { toast.error(err.message); }
    setQrLoading(false);
  }

  async function handleCheckStatus(id: string) {
    try {
      const data = await getWhatsAppStatus(id);
      toast.success(data.connected ? "Conectado!" : "Desconectado");
      loadInstances();
    } catch (err: any) { toast.error(err.message); }
  }

  async function handleRestart(id: string) {
    try { await restartWhatsAppInstance(id); toast.success("Instância reiniciada!"); loadInstances(); } catch (err: any) { toast.error(err.message); }
  }

  async function handleDisconnect(id: string) {
    if (!confirm("Desconectar esta instância?")) return;
    try { await disconnectWhatsAppInstance(id); toast.success("Desconectada!"); loadInstances(); } catch (err: any) { toast.error(err.message); }
  }

  async function handleDeleteInstance(id: string) {
    if (!confirm("Tem certeza?")) return;
    try { await deleteWhatsAppInstance(id); loadInstances(); toast.success("Removida"); } catch (err: any) { toast.error(err.message); }
  }

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

  const filteredLogs = useMemo(() => {
    if (logFilter === "all") return logs;
    return logs.filter(l => l.status === logFilter);
  }, [logs, logFilter]);

  const connectedInstances = instances.filter(i => i.status === "connected");

  const variablesHelp = "{nome} = apelido do paciente\n{sessoes} = nº sessões pendentes\n{valor_sessao} = valor médio por sessão\n{valor_total} = valor total devido";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><MessageSquare className="h-6 w-6" /> WhatsApp</h1>
          <p className="text-muted-foreground text-sm">Gerenciamento de conexão, templates e envios</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="connection"><Wifi className="h-4 w-4 mr-1" /> Conexão</TabsTrigger>
          <TabsTrigger value="templates"><MessageSquare className="h-4 w-4 mr-1" /> Templates</TabsTrigger>
          <TabsTrigger value="billing"><Send className="h-4 w-4 mr-1" /> Cobranças</TabsTrigger>
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
                  <Button size="sm" variant="outline" onClick={() => handleGetQR(inst.id)}>
                    <QrCode className="h-4 w-4 mr-1" /> QR Code
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleCheckStatus(inst.id)}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Status
                  </Button>
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => handleRestart(inst.id)}>
                        <RotateCcw className="h-4 w-4 mr-1" /> Reiniciar
                      </Button>
                      {inst.status === "connected" && (
                        <Button size="sm" variant="secondary" onClick={() => handleDisconnect(inst.id)}>
                          <WifiOff className="h-4 w-4 mr-1" /> Desconectar
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => handleDeleteInstance(inst.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
              <p className="text-xs text-muted-foreground text-center">Escaneie com o WhatsApp no celular. O código expira em 20s.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => qrInstanceId && handleGetQR(qrInstanceId)}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* New instance dialog */}
          <Dialog open={showNewInstance} onOpenChange={setShowNewInstance}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nova Conexão WhatsApp</DialogTitle>
                <p className="text-sm text-muted-foreground">Escolha o provedor e configure sua conexão.</p>
              </DialogHeader>
              <div className="space-y-5">
                <div>
                  <Label>Provedor</Label>
                  <div className="mt-1 flex items-center gap-2 border rounded-md p-3 bg-muted/30">
                    <span className="text-lg">📡</span>
                    <span className="font-medium">W-API</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">W-API: Cria instância automaticamente ou use dados manuais</p>
                </div>

                <div>
                  <Label>Nome da Conexão</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: WhatsApp Principal" className="mt-1" />
                </div>

                <div className="border rounded-md p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Criar instância automaticamente</p>
                      <p className="text-xs text-muted-foreground">Usa o token de integrador configurado em Admin {'>'} Integrações</p>
                    </div>
                    <Switch checked={autoCreate} onCheckedChange={setAutoCreate} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Rejeitar chamadas</p>
                      <p className="text-xs text-muted-foreground">Rejeitar chamadas recebidas automaticamente</p>
                    </div>
                    <Switch checked={rejectCalls} onCheckedChange={setRejectCalls} />
                  </div>
                </div>

                {rejectCalls && (
                  <div>
                    <Label>Mensagem de rejeição</Label>
                    <Textarea value={callMessage} onChange={e => setCallMessage(e.target.value)} placeholder="Não estamos disponíveis no momento." rows={2} className="mt-1" />
                  </div>
                )}

                {autoCreate ? (
                  <div>
                    <Label>Token Global (Integrador W-API)</Label>
                    <Input value={globalToken} onChange={e => setGlobalToken(e.target.value)} placeholder="Seu token de integrador" type="password" className="mt-1" />
                  </div>
                ) : (
                  <>
                    <div>
                      <Label>Instance ID</Label>
                      <Input value={manualInstanceId} onChange={e => setManualInstanceId(e.target.value)} placeholder="ID da instância existente" className="mt-1" />
                    </div>
                    <div>
                      <Label>Token da Instância</Label>
                      <Input value={manualToken} onChange={e => setManualToken(e.target.value)} placeholder="Token da instância" type="password" className="mt-1" />
                    </div>
                  </>
                )}
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowNewInstance(false)}>Cancelar</Button>
                <Button onClick={handleCreateInstance} disabled={creatingInstance}>
                  {creatingInstance ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />} Criar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===== TEMPLATES ===== */}
        <TabsContent value="templates" className="space-y-4">
          {isAdmin && (
            <Button onClick={() => setShowNewTemplate(true)}><Plus className="h-4 w-4 mr-1" /> Novo Template</Button>
          )}
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
                  {t.media_url && <p className="text-xs text-muted-foreground truncate">📎 {t.media_url}</p>}
                  {isAdmin && (
                    <Button size="sm" variant="destructive" className="mt-2" onClick={() => handleDeleteTemplate(t.id)}>
                      <Trash2 className="h-4 w-4 mr-1" /> Remover
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Dialog open={showNewTemplate} onOpenChange={setShowNewTemplate}>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo Template</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome</Label><Input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="Cobrança mensal" /></div>
                <div><Label>Tipo</Label>
                  <Select value={tplType} onValueChange={setTplType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="audio">Áudio</SelectItem>
                      <SelectItem value="video">Vídeo</SelectItem>
                      <SelectItem value="document">Documento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Mensagem</Label><Textarea value={tplMessage} onChange={e => setTplMessage(e.target.value)} placeholder="Olá {nome}, você tem {sessoes} sessões pendentes..." rows={4} /></div>
                {tplType !== "text" && <div><Label>URL da mídia</Label><Input value={tplMediaUrl} onChange={e => setTplMediaUrl(e.target.value)} placeholder="https://..." /></div>}
              </div>
              <DialogFooter>
                <Button onClick={handleCreateTemplate}><Plus className="h-4 w-4 mr-1" /> Criar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ===== COBRANÇAS ===== */}
        <TabsContent value="billing" className="space-y-4">
          <Button onClick={() => setShowBilling(true)} disabled={!connectedInstances.length || !templates.length}>
            <Send className="h-4 w-4 mr-1" /> Enviar Cobranças
          </Button>
          {!connectedInstances.length && <p className="text-sm text-muted-foreground">⚠️ Conecte uma instância primeiro</p>}
          {!templates.length && <p className="text-sm text-muted-foreground">⚠️ Crie um template primeiro</p>}

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
                  <Label>Pacientes ({selectedPatients.length} selecionados)</Label>
                  <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1 mt-1">
                    {patients.filter(p => p.phone).map(p => (
                      <label key={p.id} className="flex items-center gap-2 text-sm hover:bg-muted p-1 rounded cursor-pointer">
                        <Checkbox
                          checked={selectedPatients.includes(p.id)}
                          onCheckedChange={c => setSelectedPatients(prev => c ? [...prev, p.id] : prev.filter(x => x !== p.id))}
                        />
                        <span>{p.name}</span>
                        <span className="text-muted-foreground text-xs ml-auto">{p.phone}</span>
                      </label>
                    ))}
                    {!patients.filter(p => p.phone).length && <p className="text-sm text-muted-foreground text-center">Nenhum paciente com telefone</p>}
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
                <SelectItem value="pending">Pendentes</SelectItem>
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
                        <Button size="sm" variant="ghost" onClick={() => handleResend(l.id)}>
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}
                      {l.error_message && (
                        <span className="text-xs text-destructive block max-w-[150px] truncate" title={l.error_message}>
                          {l.error_message}
                        </span>
                      )}
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
    </div>
  );
}
