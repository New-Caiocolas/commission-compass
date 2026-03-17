import { useFiltros } from '@/contexts/FiltrosContext';
import { MESES } from '@/utils/formatters';

export function FiltrosMes() {
  const { meses, setMeses } = useFiltros();

  const toggleMes = (m: number) => {
    setMeses(meses.includes(m) ? meses.filter(x => x !== m) : [...meses, m]);
  };

  const selecionarTodos = () => {
    setMeses(meses.length === 12 ? [] : Array.from({ length: 12 }, (_, i) => i + 1));
  };

  const todosAtivos = meses.length === 12;
  const nenhumAtivo = meses.length === 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-mono text-muted-foreground tracking-widest uppercase mr-1">Mês</span>
      <button
        onClick={selecionarTodos}
        className={`px-2.5 py-1 rounded text-xs font-mono font-semibold tracking-wide transition-all border ${
          todosAtivos || nenhumAtivo
            ? 'bg-primary/15 text-primary border-primary/40 glow-primary-sm'
            : 'bg-secondary/50 text-muted-foreground border-border/60 hover:border-border hover:text-foreground'
        }`}
      >
        Todos
      </button>
      {MESES.map((label, i) => (
        <button
          key={i}
          onClick={() => toggleMes(i + 1)}
          className={`px-2.5 py-1 rounded text-xs font-mono font-semibold tracking-wide transition-all border ${
            meses.includes(i + 1)
              ? 'bg-primary/15 text-primary border-primary/40 glow-primary-sm'
              : 'bg-secondary/50 text-muted-foreground border-border/60 hover:border-border hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
