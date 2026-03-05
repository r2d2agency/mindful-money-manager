import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { BrandingProvider } from "@/contexts/BrandingContext";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Patients from "@/pages/Patients";
import Sessions from "@/pages/Sessions";
import Psychologists from "@/pages/Psychologists";
import PersonalFinances from "@/pages/PersonalFinances";
import Reports from "@/pages/Reports";
import UsersPage from "@/pages/Users";
import SettingsPage from "@/pages/Settings";
import Login from "@/pages/Login";
import WhatsAppPage from "@/pages/WhatsApp";
import NotFound from "./pages/NotFound";
import { ReactNode } from "react";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { isLoggedIn, isAdmin } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <AppLayout>{children}</AppLayout>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <BrandingProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/pacientes" element={<ProtectedRoute><Patients /></ProtectedRoute>} />
            <Route path="/sessoes" element={<ProtectedRoute><Sessions /></ProtectedRoute>} />
            <Route path="/psicologos" element={<AdminRoute><Psychologists /></AdminRoute>} />
            <Route path="/usuarios" element={<AdminRoute><UsersPage /></AdminRoute>} />
            <Route path="/configuracoes" element={<AdminRoute><SettingsPage /></AdminRoute>} />
            <Route path="/whatsapp" element={<AdminRoute><WhatsAppPage /></AdminRoute>} />
            <Route path="/relatorios" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/financas" element={<ProtectedRoute><PersonalFinances /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </BrandingProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
