import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { fetchSettings } from "@/lib/api";

interface BrandingSettings {
  app_name: string;
  logo_url: string;
  primary_h: string;
  primary_s: string;
  primary_l: string;
  accent_h: string;
  accent_s: string;
  accent_l: string;
  sidebar_h: string;
  sidebar_s: string;
  sidebar_l: string;
}

const defaults: BrandingSettings = {
  app_name: "PsiFinance",
  logo_url: "",
  primary_h: "199", primary_s: "89", primary_l: "38",
  accent_h: "168", accent_s: "60", accent_l: "42",
  sidebar_h: "199", sidebar_s: "89", sidebar_l: "18",
};

interface BrandingContextType {
  branding: BrandingSettings;
  reload: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType>({
  branding: defaults,
  reload: async () => {},
});

function applyBranding(b: BrandingSettings) {
  const root = document.documentElement;
  root.style.setProperty("--primary", `${b.primary_h} ${b.primary_s}% ${b.primary_l}%`);
  root.style.setProperty("--ring", `${b.primary_h} ${b.primary_s}% ${b.primary_l}%`);
  root.style.setProperty("--accent", `${b.accent_h} ${b.accent_s}% ${b.accent_l}%`);
  root.style.setProperty("--sidebar-background", `${b.sidebar_h} ${b.sidebar_s}% ${b.sidebar_l}%`);
  root.style.setProperty("--sidebar-primary", `${b.primary_h} ${b.primary_s}% 55%`);
  root.style.setProperty("--sidebar-accent", `${b.sidebar_h} 60% 25%`);
  root.style.setProperty("--sidebar-border", `${b.sidebar_h} 50% 25%`);
  root.style.setProperty("--sidebar-ring", `${b.primary_h} ${b.primary_s}% 55%`);
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingSettings>(defaults);

  async function reload() {
    try {
      const data = await fetchSettings();
      const merged = { ...defaults, ...data };
      setBranding(merged);
      applyBranding(merged);
    } catch {
      // not logged in or no settings yet
    }
  }

  useEffect(() => { reload(); }, []);

  return (
    <BrandingContext.Provider value={{ branding, reload }}>
      {children}
    </BrandingContext.Provider>
  );
}

export const useBranding = () => useContext(BrandingContext);
