import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBranding } from "@/contexts/BrandingContext";
import { updateSettings } from "@/lib/api";
import { Loader2, Palette, Upload, Type, Save, Check } from "lucide-react";
import { toast } from "sonner";

const COLOR_PRESETS = [
  { name: "Azul Clássico", primary_h: "199", primary_s: "89", primary_l: "38", accent_h: "168", accent_s: "60", accent_l: "42", sidebar_h: "199", sidebar_s: "89", sidebar_l: "18" },
  { name: "Verde Natureza", primary_h: "152", primary_s: "60", primary_l: "38", accent_h: "120", accent_s: "50", accent_l: "40", sidebar_h: "152", sidebar_s: "50", sidebar_l: "15" },
  { name: "Roxo Elegante", primary_h: "270", primary_s: "65", primary_l: "45", accent_h: "290", accent_s: "55", accent_l: "50", sidebar_h: "270", sidebar_s: "60", sidebar_l: "18" },
  { name: "Coral Quente", primary_h: "12", primary_s: "76", primary_l: "52", accent_h: "38", accent_s: "92", accent_l: "50", sidebar_h: "12", sidebar_s: "50", sidebar_l: "18" },
  { name: "Teal Moderno", primary_h: "180", primary_s: "60", primary_l: "35", accent_h: "195", accent_s: "55", accent_l: "45", sidebar_h: "180", sidebar_s: "55", sidebar_l: "15" },
  { name: "Rosa Suave", primary_h: "330", primary_s: "65", primary_l: "50", accent_h: "340", accent_s: "50", accent_l: "55", sidebar_h: "330", sidebar_s: "40", sidebar_l: "18" },
  { name: "Dourado Premium", primary_h: "38", primary_s: "85", primary_l: "45", accent_h: "30", accent_s: "70", accent_l: "50", sidebar_h: "38", sidebar_s: "30", sidebar_l: "15" },
  { name: "Cinza Escuro", primary_h: "220", primary_s: "15", primary_l: "40", accent_h: "210", accent_s: "20", accent_l: "50", sidebar_h: "220", sidebar_s: "15", sidebar_l: "12" },
];

export default function Settings() {
  const { branding, reload } = useBranding();
  const [form, setForm] = useState(branding);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setForm(branding); }, [branding]);

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  function applyPreset(preset: typeof COLOR_PRESETS[0]) {
    setForm(f => ({
      ...f,
      primary_h: preset.primary_h, primary_s: preset.primary_s, primary_l: preset.primary_l,
      accent_h: preset.accent_h, accent_s: preset.accent_s, accent_l: preset.accent_l,
      sidebar_h: preset.sidebar_h, sidebar_s: preset.sidebar_s, sidebar_l: preset.sidebar_l,
    }));
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) { toast.error("Logo deve ter no máximo 500KB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      set("logo_url", reader.result as string);
      toast.success("Logo carregada! Clique em Salvar para aplicar.");
    };
    reader.readAsDataURL(file);
  }

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
              <Label>Logo</Label>
              <div className="flex gap-2 mt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />Enviar do Computador
                </Button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
              <div className="mt-2">
                <Label className="text-xs text-muted-foreground">Ou cole uma URL</Label>
                <Input value={form.logo_url?.startsWith("data:") ? "" : form.logo_url} onChange={e => set("logo_url", e.target.value)} placeholder="https://..." className="mt-1" />
              </div>
            </div>
            {form.logo_url && (
              <div className="flex justify-center p-4 border rounded-lg bg-muted/50">
                <img src={form.logo_url} alt="Logo preview" className="h-16 object-contain" />
              </div>
            )}
            {form.logo_url && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => set("logo_url", "")}>
                Remover Logo
              </Button>
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
                {form.logo_url && <img src={form.logo_url} alt="" className="h-6 w-6 rounded mr-2 object-contain" />}
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

        {/* Color presets */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Palette className="h-4 w-4" />Temas de Cores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {COLOR_PRESETS.map(preset => {
                const isActive = form.primary_h === preset.primary_h && form.primary_s === preset.primary_s && form.sidebar_h === preset.sidebar_h;
                return (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className={`relative flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${
                      isActive ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    {isActive && <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />}
                    <div className="flex gap-1 shrink-0">
                      <div className="h-6 w-6 rounded-full" style={{ background: `hsl(${preset.primary_h}, ${preset.primary_s}%, ${preset.primary_l}%)` }} />
                      <div className="h-6 w-6 rounded-full" style={{ background: `hsl(${preset.sidebar_h}, ${preset.sidebar_s}%, ${preset.sidebar_l}%)` }} />
                    </div>
                    <span className="text-xs font-medium">{preset.name}</span>
                  </button>
                );
              })}
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
