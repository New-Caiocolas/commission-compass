import { useFiltros } from '@/contexts/FiltrosContext';

const ANO_ATUAL = new Date().getFullYear();
const ANOS_PADRAO = [ANO_ATUAL - 1, ANO_ATUAL];

interface Props {
  anosDisponiveis: number[];
}

export function FiltrosAno({ anosDisponiveis }: Props) {
  const { anos, setAnos } = useFiltros();

  // Usa anos disponíveis do banco se já carregou, senão usa padrão
  const anosParaExibir = anosDisponiveis.length > 0 ? anosDisponiveis : ANOS_PADRAO;

  const todosSelecionados = anosParaExibir.every(a => anos.includes(a));

  const toggleAno = (ano: number) => {
    const novosAnos = anos.includes(ano)
      ? anos.filter(a => a !== ano)
      : [...anos, ano];
    // Nunca permite array vazio — mantém pelo menos um ano
    if (novosAnos.length > 0) setAnos(novosAnos);
  };

  const selecionarTodos = () => {
    setAnos([...anosParaExibir]);
  };

  console.log('anosParaExibir:', anosParaExibir);
  console.log('anos selecionados:', anos);
  console.log('queryAnos raw:', anosDisponiveis);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-medium text-muted-foreground mr-1">Ano:</span>
      <button
        onClick={selecionarTodos}
        className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
          todosSelecionados
            ? 'bg-primary text-primary-foreground'
            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
        }`}
      >
        Todos
      </button>
      {anosParaExibir.map(ano => (
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
