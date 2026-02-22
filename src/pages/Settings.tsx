import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranding } from "@/contexts/BrandingContext";
import { updateSettings } from "@/lib/api";
import { Loader2, Palette, Image, Type, Save } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { branding, reload } = useBranding();
  const [form, setForm] = useState(branding);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm(branding); }, [branding]);

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  async function handleSave() {
    setSaving(true);
    try {
      await updateSettings(form as unknown as Record<string, string>);
      await reload();
      toast.success("Configurações salvas!");
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  }

  const previewPrimary = `hsl(${form.primary_h}, ${form.primary_s}%, ${form.primary_l}%)`;
  const previewAccent = `hsl(${form.accent_h}, ${form.accent_s}%, ${form.accent_l}%)`;
  const previewSidebar = `hsl(${form.sidebar_h}, ${form.sidebar_s}%, ${form.sidebar_l}%)`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações de Marca</h1>
        <p className="text-muted-foreground">Personalize cores, nome e logo do sistema</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Type className="h-4 w-4" />Identidade</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Nome do App</Label>
              <Input value={form.app_name} onChange={e => set("app_name", e.target.value)} placeholder="PsiFinance" />
            </div>
            <div>
              <Label>URL do Logo (opcional)</Label>
              <Input value={form.logo_url} onChange={e => set("logo_url", e.target.value)} placeholder="https://..." />
              <p className="text-xs text-muted-foreground mt-1">Cole a URL de uma imagem. Se vazio, mostra o ícone padrão.</p>
            </div>
            {form.logo_url && (
              <div className="flex justify-center p-4 border rounded-lg bg-muted/50">
                <img src={form.logo_url} alt="Logo preview" className="h-16 object-contain" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Colors preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" />Pré-visualização</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg shrink-0" style={{ background: previewPrimary }} />
              <span className="text-sm font-medium">Cor Primária</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg shrink-0" style={{ background: previewAccent }} />
              <span className="text-sm font-medium">Cor de Destaque</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg shrink-0" style={{ background: previewSidebar }} />
              <span className="text-sm font-medium">Sidebar</span>
            </div>
            <div className="mt-4 rounded-lg overflow-hidden border">
              <div className="h-10 flex items-center px-4 text-white text-sm font-medium" style={{ background: previewSidebar }}>
                {form.app_name || "PsiFinance"}
              </div>
              <div className="p-4 bg-background">
                <button className="px-4 py-2 rounded text-sm text-white font-medium" style={{ background: previewPrimary }}>
                  Botão Exemplo
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Primary color */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cor Primária (botões, links)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Matiz (H)</Label>
                <Input type="number" min="0" max="360" value={form.primary_h} onChange={e => set("primary_h", e.target.value)} />
                <input type="range" min="0" max="360" value={form.primary_h} onChange={e => set("primary_h", e.target.value)} className="w-full mt-1" />
              </div>
              <div>
                <Label>Saturação (S%)</Label>
                <Input type="number" min="0" max="100" value={form.primary_s} onChange={e => set("primary_s", e.target.value)} />
                <input type="range" min="0" max="100" value={form.primary_s} onChange={e => set("primary_s", e.target.value)} className="w-full mt-1" />
              </div>
              <div>
                <Label>Luminosidade (L%)</Label>
                <Input type="number" min="0" max="100" value={form.primary_l} onChange={e => set("primary_l", e.target.value)} />
                <input type="range" min="0" max="100" value={form.primary_l} onChange={e => set("primary_l", e.target.value)} className="w-full mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Accent color */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cor de Destaque (badges, destaques)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Matiz (H)</Label>
                <Input type="number" min="0" max="360" value={form.accent_h} onChange={e => set("accent_h", e.target.value)} />
                <input type="range" min="0" max="360" value={form.accent_h} onChange={e => set("accent_h", e.target.value)} className="w-full mt-1" />
              </div>
              <div>
                <Label>Saturação (S%)</Label>
                <Input type="number" min="0" max="100" value={form.accent_s} onChange={e => set("accent_s", e.target.value)} />
                <input type="range" min="0" max="100" value={form.accent_s} onChange={e => set("accent_s", e.target.value)} className="w-full mt-1" />
              </div>
              <div>
                <Label>Luminosidade (L%)</Label>
                <Input type="number" min="0" max="100" value={form.accent_l} onChange={e => set("accent_l", e.target.value)} />
                <input type="range" min="0" max="100" value={form.accent_l} onChange={e => set("accent_l", e.target.value)} className="w-full mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar color */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Cor do Menu Lateral</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 max-w-lg">
              <div>
                <Label>Matiz (H)</Label>
                <Input type="number" min="0" max="360" value={form.sidebar_h} onChange={e => set("sidebar_h", e.target.value)} />
                <input type="range" min="0" max="360" value={form.sidebar_h} onChange={e => set("sidebar_h", e.target.value)} className="w-full mt-1" />
              </div>
              <div>
                <Label>Saturação (S%)</Label>
                <Input type="number" min="0" max="100" value={form.sidebar_s} onChange={e => set("sidebar_s", e.target.value)} />
                <input type="range" min="0" max="100" value={form.sidebar_s} onChange={e => set("sidebar_s", e.target.value)} className="w-full mt-1" />
              </div>
              <div>
                <Label>Luminosidade (L%)</Label>
                <Input type="number" min="0" max="100" value={form.sidebar_l} onChange={e => set("sidebar_l", e.target.value)} />
                <input type="range" min="0" max="100" value={form.sidebar_l} onChange={e => set("sidebar_l", e.target.value)} className="w-full mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
