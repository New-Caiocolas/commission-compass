import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FileText, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function Sidebar() {
  const { profile } = useAuth();
  const cargo = profile?.cargo;

  const links = [
    cargo !== 'vendedor' && { to: '/',      label: 'Dashboard',     icon: LayoutDashboard },
    cargo !== 'vendedor' && { to: '/notas', label: 'Detalhes de NFs', icon: FileText },
    cargo === 'administrador' && { to: '/admin', label: 'Usuários', icon: ShieldCheck },
  ].filter(Boolean) as { to: string; label: string; icon: React.ElementType }[];

  return (
    <aside className="w-56 bg-sidebar border-r flex flex-col shrink-0">
      <nav className="flex-1 py-4 space-y-1 px-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
