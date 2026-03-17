import { LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const CARGO_LABEL: Record<string, string> = {
  administrador: 'Admin',
  supervisor:    'Supervisor',
  vendedor:      'Vendedor',
};

const CARGO_COLOR: Record<string, string> = {
  administrador: 'text-primary border-primary/40 bg-primary/10',
  supervisor:    'text-warning border-warning/40 bg-warning/10',
  vendedor:      'text-blue-400 border-blue-400/40 bg-blue-400/10',
};

export function Header() {
  const { profile, signOut } = useAuth();

  return (
    <header className="h-14 border-b border-border/60 bg-card/80 backdrop-blur-sm flex items-center px-6 shrink-0 gap-4">
      {/* Logo */}
      <span className="font-mono text-lg font-bold tracking-tighter text-primary text-glow">
        ello
      </span>

      <div className="h-5 w-px bg-border" />

      <h1 className="text-xs font-semibold text-muted-foreground tracking-widest uppercase flex-1">
        Comissão sobre Notas Liquidadas
      </h1>

      {profile && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{profile.nome}</span>
            <span className={`text-xs border px-2 py-0.5 rounded-full font-mono font-bold tracking-wide ${CARGO_COLOR[profile.cargo] ?? 'text-muted-foreground border-border bg-secondary'}`}>
              {CARGO_LABEL[profile.cargo]}
            </span>
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border/60 rounded-full px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Online
          </div>

          <Button variant="ghost" size="icon" onClick={signOut} title="Sair"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </header>
  );
}
