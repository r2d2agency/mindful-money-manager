import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarInset, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Calendar, UserCog, Wallet, Brain, LogOut, BarChart3, Shield, Settings, MoreHorizontal } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

const clinicMenu = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/", mobileNav: true },
  { title: "Pacientes", icon: Users, path: "/pacientes", mobileNav: true },
  { title: "Sessões", icon: Calendar, path: "/sessoes", mobileNav: true },
  { title: "Relatórios", icon: BarChart3, path: "/relatorios" },
  { title: "Psicólogos", icon: UserCog, path: "/psicologos", adminOnly: true },
  { title: "Usuários", icon: Shield, path: "/usuarios", adminOnly: true },
  { title: "Configurações", icon: Settings, path: "/configuracoes", adminOnly: true },
];

const personalMenu = [
  { title: "Finanças", icon: Wallet, path: "/financas", mobileNav: true },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, isAdmin, handleLogout } = useAuth();
  const { branding } = useBranding();
  const isMobile = useIsMobile();
  const [moreOpen, setMoreOpen] = useState(false);

  const visibleClinicMenu = clinicMenu.filter(item => !item.adminOnly || isAdmin);
  const allItems = [...visibleClinicMenu, ...personalMenu];
  const bottomNavItems = allItems.filter(i => i.mobileNav);
  const moreItems = allItems.filter(i => !i.mobileNav);

  if (isMobile) {
    return (
      <div className="flex flex-col h-[100dvh] bg-background">
        {/* Mobile header */}
        <header className="flex h-12 items-center gap-2 border-b px-4 shrink-0 safe-top">
          <Link to="/" className="flex items-center gap-2">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt="Logo" className="h-7 w-7 rounded-md object-contain" />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
                <Brain className="h-4 w-4 text-primary-foreground" />
              </div>
            )}
            <span className="font-semibold text-sm">{branding.app_name || "PsiFinance"}</span>
          </Link>
          <div className="ml-auto">
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Mobile content */}
        <main className="flex-1 overflow-auto p-3 pb-20">
          {children}
        </main>

        {/* Bottom navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-background border-t safe-bottom z-50">
          <div className="flex items-center justify-around h-16 px-1">
            {bottomNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <item.icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                  <span className="text-[10px] font-medium leading-tight">{item.title}</span>
                </Link>
              );
            })}
            {/* More button */}
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger asChild>
                <button className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg text-muted-foreground">
                  <MoreHorizontal className="h-5 w-5" />
                  <span className="text-[10px] font-medium leading-tight">Mais</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl">
                <div className="grid grid-cols-3 gap-4 py-4">
                  {moreItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMoreOpen(false)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-colors ${
                          isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                        }`}
                      >
                        <item.icon className="h-6 w-6" />
                        <span className="text-xs font-medium text-center">{item.title}</span>
                      </Link>
                    );
                  })}
                  <button
                    onClick={() => { setMoreOpen(false); handleLogout(); }}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-6 w-6" />
                    <span className="text-xs font-medium">Sair</span>
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>
      </div>
    );
  }

  // Desktop layout (unchanged)
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
          <Link to="/" className="flex items-center gap-2">
            {branding.logo_url ? (
              <img src={branding.logo_url} alt="Logo" className="h-9 w-9 rounded-lg object-contain" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
                <Brain className="h-5 w-5 text-sidebar-primary-foreground" />
              </div>
            )}
            <div>
              <h1 className="text-sm font-bold text-sidebar-foreground">{branding.app_name || "PsiFinance"}</h1>
              <p className="text-xs text-sidebar-foreground/60">{user?.name || "Gestão Clínica"}</p>
            </div>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Clínica</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleClinicMenu.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.path}>
                      <Link to={item.path}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Pessoal</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {personalMenu.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.path}>
                      <Link to={item.path}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <div className="p-4 border-t">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
