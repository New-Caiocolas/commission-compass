import { useFiltros } from '@/contexts/FiltrosContext';

interface Props {
  anosDisponiveis: number[];
}

export function FiltrosAno({ anosDisponiveis }: Props) {
  const { anos, setAnos } = useFiltros();

  const toggleAno = (ano: number) => {
    setAnos(anos.includes(ano) ? anos.filter(a => a !== ano) : [...anos, ano]);
  };

  const selecionarTodos = () => {
    setAnos(anos.length === anosDisponiveis.length ? [] : [...anosDisponiveis]);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-muted-foreground mr-1">Ano:</span>
      <button
        onClick={selecionarTodos}
        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
          anos.length === anosDisponiveis.length
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
        }`}
      >
        Todos
      </button>
      {anosDisponiveis.map(ano => (
        <button
          key={ano}
          onClick={() => toggleAno(ano)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            anos.includes(ano)
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          {ano}
        </button>
      ))}
    </div>
  );
}
