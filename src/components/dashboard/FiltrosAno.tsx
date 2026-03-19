import React, { useCallback, useMemo } from 'react';
import { useFiltros } from '@/contexts/FiltrosContext';

const ANO_ATUAL = new Date().getFullYear();
const ANOS_PADRAO = [ANO_ATUAL - 1, ANO_ATUAL];

interface Props {
  anosDisponiveis: number[];
}

export const FiltrosAno = React.memo(function FiltrosAno({ anosDisponiveis }: Props) {
  const { anos, setAnos } = useFiltros();

  const anosParaExibir = useMemo(
    () => anosDisponiveis.length > 0 ? anosDisponiveis : ANOS_PADRAO,
    [anosDisponiveis],
  );
  const todosSelecionados = anosParaExibir.every(a => anos.includes(a));

  const toggleAno = useCallback((ano: number) => {
    setAnos(
      anos.includes(ano)
        ? anos.filter(a => a !== ano)
        : [...anos, ano],
    );
  }, [anos, setAnos]);

  const selecionarTodos = useCallback(() => setAnos([...anosParaExibir]), [anosParaExibir, setAnos]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-mono text-muted-foreground tracking-widest uppercase mr-1">Ano</span>
      <button
        onClick={selecionarTodos}
        className={`px-2.5 py-1 rounded text-xs font-mono font-semibold tracking-wide transition-all border ${
          todosSelecionados
            ? 'bg-primary/15 text-primary border-primary/40 glow-primary-sm'
            : 'bg-secondary/50 text-muted-foreground border-border/60 hover:border-border hover:text-foreground'
        }`}
      >
        Todos
      </button>
      {anosParaExibir.map(ano => (
        <button
          key={ano}
          onClick={() => toggleAno(ano)}
          className={`px-2.5 py-1 rounded text-xs font-mono font-semibold tracking-wide transition-all border ${
            anos.includes(ano)
              ? 'bg-primary/15 text-primary border-primary/40 glow-primary-sm'
              : 'bg-secondary/50 text-muted-foreground border-border/60 hover:border-border hover:text-foreground'
          }`}
        >
          {ano}
        </button>
      ))}
    </div>
  );
});
