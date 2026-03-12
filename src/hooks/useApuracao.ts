import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFiltros } from '@/contexts/FiltrosContext';
import { ApuracaoRecord, calcularMedidas, agruparPorVendedor } from '@/utils/calculos';

export function useApuracao() {
  const { anos, meses } = useFiltros();

  const query = useQuery({
    queryKey: ['apuracao', anos, meses],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes')
        .select('*')
        .order('dt_pag', { ascending: false });

      if (error) throw error;
      return (data || []) as ApuracaoRecord[];
    },
  });

  const dadosFiltrados = useMemo(() => {
    if (!query.data) return [];
    return query.data.filter(r => {
      if (!r.dt_pag) return false;
      const d = new Date(r.dt_pag + 'T00:00:00');
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      if (anos.length > 0 && !anos.includes(year)) return false;
      if (meses.length > 0 && !meses.includes(month)) return false;
      return true;
    });
  }, [query.data, anos, meses]);

  const anosDisponiveis = useMemo(() => {
    if (!query.data) return [];
    const set = new Set<number>();
    query.data.forEach(r => {
      if (r.dt_pag) set.add(new Date(r.dt_pag + 'T00:00:00').getFullYear());
    });
    return Array.from(set).sort();
  }, [query.data]);

  const totais = useMemo(() => calcularMedidas(dadosFiltrados), [dadosFiltrados]);
  const porVendedor = useMemo(() => agruparPorVendedor(dadosFiltrados), [dadosFiltrados]);

  return {
    dados: dadosFiltrados,
    todosOsDados: query.data || [],
    totais,
    porVendedor,
    anosDisponiveis,
    isLoading: query.isLoading,
    error: query.error,
  };
}
