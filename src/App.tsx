import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import Patients from "@/pages/Patients";
import Sessions from "@/pages/Sessions";
import Psychologists from "@/pages/Psychologists";
import PersonalFinances from "@/pages/PersonalFinances";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout><Dashboard /></AppLayout>} />
          <Route path="/pacientes" element={<AppLayout><Patients /></AppLayout>} />
          <Route path="/sessoes" element={<AppLayout><Sessions /></AppLayout>} />
          <Route path="/psicologos" element={<AppLayout><Psychologists /></AppLayout>} />
          <Route path="/financas" element={<AppLayout><PersonalFinances /></AppLayout>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
