import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFiltros } from '@/contexts/FiltrosContext';
import { calcularMedidas, agruparPorVendedor } from '@/utils/calculos';

interface ApuracaoRPCRow {
  nome_rep: string;
  vlr_nf: number;
  vlr_comissao_ajustada: number;
  vlr_negativo: number;
  vlr_excedente_nf: number;
  vlr_frete_cte: number;
  vlr_frete_desp: number;
  desconto_1: number;
}

export function useApuracao() {
  const { anos, meses } = useFiltros();

  // Query anos disponíveis — independente do filtro
  const queryAnos = useQuery({
    queryKey: ['anos-disponiveis'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_anos_disponiveis');
      if (error) throw error;
      return (data as { ano: number }[]).map(r => r.ano);
    },
    staleTime: 1000 * 60 * 10,
  });

  // Query principal — agrupada por vendedor direto no banco
  const query = useQuery({
    queryKey: ['apuracao', anos, meses],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_apuracao', {
        anos_filtro: anos,
      });
      if (error) throw error;
      return (data as ApuracaoRPCRow[]) || [];
    },
    enabled: anos.length > 0,
  });

  // Calcular medidas para cada vendedor
  const porVendedor = useMemo(() => {
    if (!query.data) return [];
    return agruparPorVendedor(query.data);
  }, [query.data]);

  // Totais gerais
  const totais = useMemo(() => {
    if (!query.data) return calcularMedidas([]);
    return calcularMedidas(query.data);
  }, [query.data]);

  return {
    dados: query.data || [],
    totais,
    porVendedor,
    anosDisponiveis: queryAnos.data || [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
