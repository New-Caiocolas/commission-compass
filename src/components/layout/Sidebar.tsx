import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, ShieldCheck, Users, UserCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LogoIcon } from '@/components/Logo';

interface SidebarNavProps {
  onNavigate?: () => void;
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const { profile } = useAuth();
  const cargo = profile?.cargo;

  const links = [
    // Vendedor — dashboard próprio e notas próprias
    cargo === 'vendedor' && { to: '/dashboard',          label: 'Meu Dashboard',    icon: LayoutDashboard },
    cargo === 'vendedor' && { to: '/notas',              label: 'Notas Fiscais',    icon: FileText },

    // Supervisor e Admin — dashboard geral
    cargo !== 'vendedor' && { to: '/',                   label: 'Dashboard',        icon: LayoutDashboard },
    cargo === 'administrador' && { to: '/clientes-ativos', label: 'Clientes Ativos', icon: Users },
    cargo !== 'vendedor' && { to: '/notas',              label: 'Notas Fiscais',    icon: FileText },
    cargo === 'administrador' && { to: '/admin',         label: 'Usuários',         icon: ShieldCheck },

    // Todos os cargos
    { to: '/perfil',                                      label: 'Meu Perfil',       icon: UserCircle },
  ].filter(Boolean) as { to: string; label: string; icon: React.ElementType }[];

  return (
    <>
      <nav className="flex-1 py-4 space-y-0.5 px-3">
        {links.map(({ to, label, icon: Icon }, i) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/' || to === '/dashboard'}
            onClick={onNavigate}
            style={{ animationDelay: `${i * 60}ms` }}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 animate-slide-up ${
                isActive
                  ? 'bg-primary/10 text-primary border border-primary/20 glow-primary-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground border border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
                <span className={isActive ? 'font-semibold' : ''}>{label}</span>
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border flex items-center gap-2">
        <LogoIcon size={18} />
        <span className="text-[10px] font-mono text-muted-foreground/40 tracking-widest uppercase">
          ello v2.0
        </span>
      </div>
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-56 bg-sidebar border-r border-sidebar-border flex-col shrink-0">
      <SidebarNav />
    </aside>
  );
}