import { LucideIcon } from 'lucide-react';

interface KPICardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  valueColor?: 'default' | 'positive' | 'negative';
}

export function KPICard({ label, value, icon: Icon, valueColor = 'default' }: KPICardProps) {
  const colorClass =
    valueColor === 'positive'
      ? 'text-success'
      : valueColor === 'negative'
      ? 'text-destructive'
      : 'text-foreground';

  return (
    <div className="bg-card border rounded-lg p-4 flex items-start gap-4">
      <div className="rounded-md bg-primary/10 p-2.5">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0">
        <p className={`text-xl font-bold tabular-nums truncate ${colorClass}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}
