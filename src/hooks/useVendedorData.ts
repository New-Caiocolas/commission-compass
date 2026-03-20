import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFiltros } from '@/contexts/FiltrosContext';
import { calcularMedidas, type ApuracaoAgregada, type CalculosResult } from '@/utils/calculos';
import type { Tables } from '@/integrations/supabase/types';

type ComissaoRow = Tables<'comissoes'>;

export interface PorMesItem {
  mes: string;
  vlrNF: number;
  vlrComissaoFinal: number;
  percComissaoFinal: number;
  vlrFreteCTE: number;
  vlrFreteDespAcessoria: number;
}

export interface PorClienteItem {
  nomeCliente: string;
  vlrNF: number;
  vlrNegativo: number;
  qtdNFs: number;
  temDevolucao: boolean;
}

function rowToAgregada(rows: ComissaoRow[]): ApuracaoAgregada {
  return {
    repres_vend: rows[0]?.repres_vend ?? 0,
    nome_rep: rows[0]?.nome_rep ?? '',
    vlr_nf: rows.reduce((s, r) => s + (Number(r.prc_nf) || 0), 0),
    vlr_comissao_ajustada: rows.reduce((s, r) => s + (Number(r.vlr_ajustada) || 0), 0),
    vlr_negativo: rows.reduce((s, r) => s + (Number(r.vlr_negativa) || 0), 0),
    vlr_excedente_nf: rows.reduce((s, r) => s + (Number(r.vlr_exced) || 0), 0),
    vlr_frete_cte: rows.reduce((s, r) => s + (Number(r.vlr_frete) || 0), 0),
    vlr_frete_desp: rows.reduce((s, r) => s + (Number(r.frete_na_nf) || 0), 0),
    desconto_1: rows.reduce((s, r) => s + (Number(r.desconto_1) || 0), 0),
  };
}

function getMesLabel(dt: string | null): string {
  if (!dt) return '';
  const d = new Date(dt);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function useVendedorData(represVend: number) {
  const { anos, meses } = useFiltros();

  const query = useQuery({
    queryKey: ['vendedor', represVend, anos, meses],
    queryFn: async () => {
      let q = supabase
        .from('comissoes')
        .select('*')
        .eq('repres_vend', represVend);

      if (anos.length > 0) {
        const orFilters = anos
          .map(a => `and(dt_pag.gte.${a}-01-01,dt_pag.lte.${a}-12-31)`)
          .join(',');
        q = q.or(orFilters);
      }

      const { data, error } = await q.order('dt_pag', { ascending: true });
      if (error) throw error;
      return (data as ComissaoRow[]) || [];
    },
    enabled: represVend > 0,
  });

  const registros = useMemo(() => {
    if (!query.data) return [];
    let filtered = query.data;

    if (anos.length > 0) {
      filtered = filtered.filter(r => {
        if (!r.dt_pag) return false;
        return anos.includes(new Date(r.dt_pag).getFullYear());
      });
    }

    if (meses.length > 0) {
      filtered = filtered.filter(r => {
        if (!r.dt_pag) return false;
        return meses.includes(new Date(r.dt_pag).getMonth() + 1);
      });
    }

    return filtered;
  }, [query.data, anos, meses]);

  const calcTotal: CalculosResult = useMemo(() => {
    return calcularMedidas([rowToAgregada(registros)]);
  }, [registros]);

  const porMes: PorMesItem[] = useMemo(() => {
    const map = new Map<string, ComissaoRow[]>();
    for (const r of registros) {
      const key = getMesLabel(r.dt_pag);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries()).map(([mes, rows]) => {
      const ag = rowToAgregada(rows);
      const c = calcularMedidas([ag]);
      return {
        mes,
        vlrNF: c.vlrNF,
        vlrComissaoFinal: c.vlrComissaoFinal,
        percComissaoFinal: c.percComissaoFinal,
        vlrFreteCTE: c.vlrFreteCTE,
        vlrFreteDespAcessoria: c.vlrFreteDespAcessoria,
      };
    });
  }, [registros]);

  // Agregado por cliente
  const porCliente: PorClienteItem[] = useMemo(() => {
    const map = new Map<string, ComissaoRow[]>();
    for (const r of registros) {
      const key = r.nome_cliente ?? 'Desconhecido';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries())
      .map(([nomeCliente, rows]) => ({
        nomeCliente,
        vlrNF: rows.reduce((s, r) => s + (Number(r.prc_nf) || 0), 0),
        vlrNegativo: rows.reduce((s, r) => s + (Number(r.vlr_negativa) || 0), 0),
        qtdNFs: rows.length,
        temDevolucao: rows.some(r => (Number(r.vlr_negativa) || 0) > 0),
      }))
      .sort((a, b) => b.vlrNF - a.vlrNF);
  }, [registros]);

  // Top 10 clientes por faturamento
  const topClientes = useMemo(() => porCliente.slice(0, 10), [porCliente]);

  // Clientes com devolução
  const clientesComDevolucao = useMemo(
    () => porCliente.filter(c => c.temDevolucao).sort((a, b) => b.vlrNegativo - a.vlrNegativo),
    [porCliente],
  );

  // Faturamento por cliente por mês (top 5 clientes)
  const fatPorClientePorMes = useMemo(() => {
    const top5 = porCliente.slice(0, 5).map(c => c.nomeCliente);
    const mesMap = new Map<string, Record<string, number>>();

    for (const r of registros) {
      const mes = getMesLabel(r.dt_pag);
      if (!mes) continue;
      const cliente = r.nome_cliente ?? 'Desconhecido';
      if (!top5.includes(cliente)) continue;
      if (!mesMap.has(mes)) mesMap.set(mes, {});
      const entry = mesMap.get(mes)!;
      entry[cliente] = (entry[cliente] || 0) + (Number(r.prc_nf) || 0);
    }

    return Array.from(mesMap.entries()).map(([mes, clientes]) => ({ mes, ...clientes }));
  }, [registros, porCliente]);

  return {
    registros,
    calcTotal,
    porMes,
    porCliente,
    topClientes,
    clientesComDevolucao,
    fatPorClientePorMes,
    isLoading: query.isLoading,
  };
}