import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function Sidebar() {
  const { profile } = useAuth();
  const cargo = profile?.cargo;

  const links = [
    cargo !== 'vendedor' && { to: '/',      label: 'Dashboard',     icon: LayoutDashboard },
    cargo !== 'vendedor' && { to: '/notas', label: 'Notas Fiscais',  icon: FileText },
    cargo === 'administrador' && { to: '/admin', label: 'Usuários', icon: ShieldCheck },
  ].filter(Boolean) as { to: string; label: string; icon: React.ElementType }[];

  return (
    <aside className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      <nav className="flex-1 py-4 space-y-0.5 px-3">
        {links.map(({ to, label, icon: Icon }, i) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
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

      {/* Bottom decoration */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="text-[10px] font-mono text-muted-foreground/40 tracking-widest uppercase">
          v2.0
        </div>
      </div>
    </aside>
  );
}
