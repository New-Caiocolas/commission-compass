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

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-muted-foreground mr-1">Mês:</span>
      <button
        onClick={selecionarTodos}
        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
          meses.length === 12
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
        }`}
      >
        Todos
      </button>
      {MESES.map((label, i) => (
        <button
          key={i}
          onClick={() => toggleMes(i + 1)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            meses.includes(i + 1)
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
