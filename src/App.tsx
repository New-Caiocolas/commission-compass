import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FiltrosProvider } from '@/contexts/FiltrosContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AppLayout } from '@/components/layout/AppLayout';
import Executivo from './pages/Executivo';
import Vendedor from './pages/Vendedor';
import Notas from './pages/Notas';
import Admin from './pages/Admin';
import Login from './pages/Login';
import ClientesAtivos from './pages/ClientesAtivos';
import DashboardSupervisor from './pages/DashboardSupervisor';
import Perfil from './pages/Perfil';
import { Skeleton } from '@/components/ui/skeleton';

const queryClient = new QueryClient();

function AppRoutes() {
  const { session, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-3 w-64">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (profile?.cargo === 'vendedor') {
    if (profile.repres_vend != null) {
      const represVend = profile.repres_vend;
      return (
        <Routes>
          <Route path="/dashboard" element={<AppLayout><Vendedor /></AppLayout>} />
          <Route path="/notas" element={<AppLayout><Notas /></AppLayout>} />
          <Route path="/perfil" element={<AppLayout><Perfil /></AppLayout>} />
          <Route path="/vendedor/:represVend" element={<AppLayout><Vendedor /></AppLayout>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Seu perfil não está vinculado a um representante. Contate o administrador.
      </div>
    );
  }

  if (profile?.cargo === 'supervisor') {
    return (
      <Routes>
        <Route path="/" element={<AppLayout><DashboardSupervisor /></AppLayout>} />
        <Route path="/vendedor/:represVend" element={<AppLayout><Vendedor /></AppLayout>} />
        <Route path="/notas" element={<AppLayout><Notas /></AppLayout>} />
        <Route path="/perfil" element={<AppLayout><Perfil /></AppLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Admin → acesso total
  return (
    <Routes>
      <Route path="/" element={<AppLayout><Executivo /></AppLayout>} />
      <Route path="/clientes-ativos" element={<AppLayout><ClientesAtivos /></AppLayout>} />
      <Route path="/vendedor/:represVend" element={<AppLayout><Vendedor /></AppLayout>} />
      <Route path="/notas" element={<AppLayout><Notas /></AppLayout>} />
      <Route path="/admin" element={<AppLayout><Admin /></AppLayout>} />
      <Route path="/perfil" element={<AppLayout><Perfil /></AppLayout>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <FiltrosProvider>
              <AppRoutes />
            </FiltrosProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;