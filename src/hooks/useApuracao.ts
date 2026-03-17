import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFiltros } from '@/contexts/FiltrosContext';
import { useAuth } from '@/contexts/AuthContext';
import { calcularMedidas, agruparPorVendedor } from '@/utils/calculos';

interface ApuracaoRPCRow {
  repres_vend: number;
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
  const { profile } = useAuth();

  // Query anos disponíveis
  const queryAnos = useQuery({
    queryKey: ['anos-disponiveis'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_anos_disponiveis');
      if (error) throw error;
      return (data as { ano: number }[]).map(r => r.ano);
    },
    staleTime: 1000 * 60 * 10,
  });

  // Query principal — agrupada por vendedor
  const query = useQuery({
    queryKey: ['apuracao', anos, meses],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_apuracao', {
        anos_filtro: anos,
        meses_filtro: meses.length > 0 ? meses : undefined,
      });
      if (error) throw error;
      return (data as ApuracaoRPCRow[]) || [];
    },
    enabled: anos.length > 0,
  });

  // Filtra vendedores que o supervisor pode ver
  const dadosFiltrados = useMemo(() => {
    if (!query.data) return [];
    if (profile?.cargo === 'supervisor' && profile.vendedores_ids?.length) {
      return query.data.filter(r => profile.vendedores_ids!.includes(r.repres_vend));
    }
    return query.data;
  }, [query.data, profile]);

  const porVendedor = useMemo(() => {
    return agruparPorVendedor(dadosFiltrados);
  }, [dadosFiltrados]);

  const totais = useMemo(() => {
    return calcularMedidas(dadosFiltrados);
  }, [dadosFiltrados]);

  return {
    dados: dadosFiltrados,
    totais,
    porVendedor,
    anosDisponiveis: queryAnos.data || [],
    isLoading: query.isLoading,
    error: query.error,
  };
}
