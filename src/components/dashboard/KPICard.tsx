import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon: LucideIcon;
  valueColor?: 'default' | 'positive' | 'negative' | 'primary';
  delta?: { value: string; direction: 'up' | 'down' | 'neutral'; label?: string };
  highlight?: boolean;
}

export function KPICard({
  label, value, sublabel, icon: Icon,
  valueColor = 'default', delta, highlight = false,
}: KPICardProps) {
  const valueClass =
    valueColor === 'positive'  ? 'text-success' :
    valueColor === 'negative'  ? 'text-destructive' :
    valueColor === 'primary'   ? 'text-primary' :
    'text-foreground';

  const DeltaIcon =
    delta?.direction === 'up'   ? TrendingUp :
    delta?.direction === 'down' ? TrendingDown : Minus;

  const deltaClass =
    delta?.direction === 'up'   ? 'text-success' :
    delta?.direction === 'down' ? 'text-destructive' :
    'text-muted-foreground';

  return (
    <div className={`
      relative bg-card border rounded-lg p-4 flex flex-col gap-3 overflow-hidden
      transition-all duration-200
      ${highlight
        ? 'border-primary/40 shadow-[0_0_16px_hsl(158_100%_52%/0.12)]'
        : 'border-border/60 hover:border-border'}
    `}>
      {/* Top accent line for highlight */}
      {highlight && (
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
      )}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground tracking-widest uppercase font-medium">
          {label}
        </span>
        <div className={`rounded-md p-1.5 ${highlight ? 'bg-primary/15' : 'bg-secondary'}`}>
          <Icon className={`h-3.5 w-3.5 ${highlight ? 'text-primary' : 'text-muted-foreground'}`} />
        </div>
      </div>

      {/* Value */}
      <div>
        <p className={`text-2xl font-bold tabular-nums font-mono leading-none ${valueClass} ${highlight ? 'text-glow' : ''}`}>
          {value}
        </p>
        {sublabel && (
          <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>
        )}
      </div>

      {/* Delta */}
      {delta && (
        <div className={`flex items-center gap-1 text-xs font-medium ${deltaClass}`}>
          <DeltaIcon className="h-3 w-3" />
          <span>{delta.value}</span>
          {delta.label && <span className="text-muted-foreground font-normal">{delta.label}</span>}
        </div>
      )}
    </div>
  );
}
