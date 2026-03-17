import { LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const CARGO_LABEL: Record<string, string> = {
  administrador: 'Administrador',
  supervisor:    'Supervisor',
  vendedor:      'Vendedor',
};

export function Header() {
  const { profile, signOut } = useAuth();

  return (
    <header className="h-14 border-b bg-card flex items-center px-6 shrink-0 gap-4">
      <span className="text-xl font-bold tracking-tight text-primary">ello</span>
      <div className="h-6 w-px bg-border" />
      <h1 className="text-sm font-semibold text-foreground tracking-wide uppercase flex-1">
        Comissão sobre Notas Liquidadas
      </h1>

      {profile && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{profile.nome}</span>
            <span className="text-xs bg-secondary px-2 py-0.5 rounded-full">
              {CARGO_LABEL[profile.cargo]}
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      )}
    </header>
  );
}
