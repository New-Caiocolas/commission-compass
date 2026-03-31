import { useState } from 'react';
import { LogOut, Menu, User, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { SidebarNav } from './Sidebar';
import { Logo } from '@/components/Logo';

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
  const { isLight, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <header className="h-14 border-b border-border/60 bg-card/80 backdrop-blur-sm flex items-center px-3 md:px-6 shrink-0 gap-2 md:gap-4">
      {/* Hamburger — mobile only */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden h-8 w-8 shrink-0"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Mobile drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0 flex flex-col">
          <SheetHeader className="px-4 py-3 border-b border-sidebar-border">
            <SheetTitle>
              <Logo size="sm" />
            </SheetTitle>
          </SheetHeader>
          <SidebarNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Logo */}
      <Logo size="sm" />

      <div className="hidden md:block h-5 w-px bg-border" />

      <h1 className="hidden md:block text-xs font-semibold text-muted-foreground tracking-widest uppercase flex-1">
        Comissão sobre Notas Liquidadas
      </h1>

      {/* Spacer on mobile */}
      <div className="flex-1 md:hidden" />

      {profile && (
        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{profile.nome}</span>
          </div>

          <span className={`text-xs border px-2 py-0.5 rounded-full font-mono font-bold tracking-wide ${CARGO_COLOR[profile.cargo] ?? 'text-muted-foreground border-border bg-secondary'}`}>
            {CARGO_LABEL[profile.cargo]}
          </span>

          {/* Status — hidden on mobile */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground border border-border/60 rounded-full px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Online
          </div>

          {/* Toggle dark/light */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            title={isLight ? 'Modo escuro' : 'Modo claro'}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            {isLight ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5 text-yellow-400" />}
          </Button>

          <Button variant="ghost" size="icon" onClick={signOut} title="Sair"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-secondary">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </header>
  );
}
