import React, { useCallback } from 'react';
import { useFiltros } from '@/contexts/FiltrosContext';
import { MESES } from '@/utils/formatters';

const TODOS_MESES = Array.from({ length: 12 }, (_, i) => i + 1);

export const FiltrosMes = React.memo(function FiltrosMes() {
  const { meses, setMeses } = useFiltros();

  const toggleMes = useCallback((m: number) => {
    setMeses(meses.includes(m) ? meses.filter(x => x !== m) : [...meses, m]);
  }, [meses, setMeses]);

  const selecionarTodos = useCallback(() => {
    setMeses(meses.length === 12 ? [] : TODOS_MESES);
  }, [meses.length, setMeses]);

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
});
