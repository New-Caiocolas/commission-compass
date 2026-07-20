import { lazy, Suspense, Component, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FiltrosProvider } from '@/contexts/FiltrosContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Skeleton } from '@/components/ui/skeleton';

// ── Lazy-loaded pages (code splitting) ───────────────────────────────────────
const Executivo = lazy(() => import('./pages/Executivo'));
const Vendedor = lazy(() => import('./pages/Vendedor'));
const Notas = lazy(() => import('./pages/Notas'));
const Admin = lazy(() => import('./pages/Admin'));
const Login = lazy(() => import('./pages/Login'));
const ClientesAtivos = lazy(() => import('./pages/ClientesAtivos'));
const DashboardSupervisor = lazy(() => import('./pages/DashboardSupervisor'));
const Perfil = lazy(() => import('./pages/Perfil'));
const FlexSemestral = lazy(() => import('./pages/FlexSemestral'));
const Financeiro = lazy(() => import('./pages/Financeiro'));

// ── QueryClient with production defaults ─────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 1000 * 60 * 2,
      refetchOnWindowFocus: false,
    },
  },
});

// ── Error Boundary ───────────────────────────────────────────────────────────
interface ErrorBoundaryState { hasError: boolean; error: Error | null }

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="text-center space-y-4 max-w-md">
            <h1 className="text-2xl font-bold text-destructive">Algo deu errado</h1>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Tente recarregar a pagina.
            </p>
            <pre className="text-xs text-left bg-secondary rounded-lg p-3 overflow-auto max-h-40 text-muted-foreground">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Recarregar pagina
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Suspense fallback ────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-12 w-72 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ── Routes ───────────────────────────────────────────────────────────────────
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
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    );
  }

  if (profile?.cargo === 'vendedor') {
    if (profile.repres_vend != null) {
      return (
        <Suspense fallback={<AppLayout><PageLoader /></AppLayout>}>
          <Routes>
            <Route path="/dashboard" element={<AppLayout><Vendedor /></AppLayout>} />
            <Route path="/notas" element={<AppLayout><Notas /></AppLayout>} />
            <Route path="/perfil" element={<AppLayout><Perfil /></AppLayout>} />
            <Route path="/vendedor/:represVend" element={<AppLayout><Vendedor /></AppLayout>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Seu perfil nao esta vinculado a um representante. Contate o administrador.
      </div>
    );
  }

  if (profile?.cargo === 'supervisor') {
    return (
      <Suspense fallback={<AppLayout><PageLoader /></AppLayout>}>
        <Routes>
          <Route path="/" element={<AppLayout><DashboardSupervisor /></AppLayout>} />
          <Route path="/vendedor/:represVend" element={<AppLayout><Vendedor /></AppLayout>} />
          <Route path="/notas" element={<AppLayout><Notas /></AppLayout>} />
          <Route path="/perfil" element={<AppLayout><Perfil /></AppLayout>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    );
  }

  // Admin — acesso total
  return (
    <Suspense fallback={<AppLayout><PageLoader /></AppLayout>}>
      <Routes>
        <Route path="/" element={<AppLayout><Executivo /></AppLayout>} />
        <Route path="/clientes-ativos" element={<AppLayout><ClientesAtivos /></AppLayout>} />
        <Route path="/vendedor/:represVend" element={<AppLayout><Vendedor /></AppLayout>} />
        <Route path="/notas" element={<AppLayout><Notas /></AppLayout>} />
        <Route path="/flex-semestral" element={<AppLayout><FlexSemestral /></AppLayout>} />
        <Route path="/financeiro" element={<AppLayout><Financeiro /></AppLayout>} />
        <Route path="/admin" element={<AppLayout><Admin /></AppLayout>} />
        <Route path="/perfil" element={<AppLayout><Perfil /></AppLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <ErrorBoundary>
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
  </ErrorBoundary>
);

export default App;
