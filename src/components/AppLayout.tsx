import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarInset, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Calendar, UserCog, Wallet, Brain, LogOut, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const clinicMenu = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/" },
  { title: "Pacientes", icon: Users, path: "/pacientes" },
  { title: "Sessões", icon: Calendar, path: "/sessoes" },
  { title: "Relatórios", icon: BarChart3, path: "/relatorios" },
  { title: "Psicólogos", icon: UserCog, path: "/psicologos", adminOnly: true },
];

const personalMenu = [
  { title: "Finanças Pessoais", icon: Wallet, path: "/financas" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, isAdmin, handleLogout } = useAuth();

  const visibleClinicMenu = clinicMenu.filter(item => !item.adminOnly || isAdmin);

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary">
              <Brain className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-sidebar-foreground">PsiFinance</h1>
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
