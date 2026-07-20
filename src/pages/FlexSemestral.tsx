import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calcularMedidas } from '@/utils/calculos';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Wallet, TrendingDown } from 'lucide-react';

interface KPIVendedor {
  nome_rep: string;
  repres_vend: number;
  qtd_nfs: number;
  qtd_clientes: number;
  vlr_nf: number;
  vlr_comissao_ajustada: number;
  vlr_negativo: number;
  vlr_excedente_nf: number;
  vlr_frete_cte: number;
  vlr_frete_desp: number;
  desconto_1: number;
}

const EXCLUIR = ['FUNCIONARIO', 'Padrão Empresa'];

const SEMESTRES = [
  { value: '1', label: '1º Semestre (Jan-Jun)', meses: [1, 2, 3, 4, 5, 6] },
  { value: '2', label: '2º Semestre (Jul-Dez)', meses: [7, 8, 9, 10, 11, 12] },
];

function useAnosDisponiveis() {
  return useQuery({
    queryKey: ['anos-disponiveis'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_anos_disponiveis');
      if (error) throw error;
      return (data as { ano: number }[]).map(r => r.ano);
    },
    staleTime: 1000 * 60 * 10,
  });
}

function useKPIsVendedorSemestre(ano: number, meses: number[]) {
  return useQuery({
    queryKey: ['kpis-vendedor-semestre', ano, meses],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_kpis_vendedor', {
        anos_filtro: [ano],
        meses_filtro: meses,
      });
      if (error) throw error;
      return (data as KPIVendedor[])
        .filter(r => r.nome_rep && !EXCLUIR.includes(r.nome_rep))
        .map(r => ({
          ...r,
          vlr_nf: Number(r.vlr_nf) || 0,
          vlr_comissao_ajustada: Number(r.vlr_comissao_ajustada) || 0,
          vlr_negativo: Number(r.vlr_negativo) || 0,
          vlr_excedente_nf: Number(r.vlr_excedente_nf) || 0,
          vlr_frete_cte: Number(r.vlr_frete_cte) || 0,
          vlr_frete_desp: Number(r.vlr_frete_desp) || 0,
          desconto_1: Number(r.desconto_1) || 0,
          qtd_nfs: Number(r.qtd_nfs) || 0,
          qtd_clientes: Number(r.qtd_clientes) || 0,
        }));
    },
    enabled: ano > 0,
    staleTime: 1000 * 60 * 2,
  });
}

export default function FlexSemestral() {
  const navigate = useNavigate();
  const anoAtual = new Date().getFullYear();
  const { data: anosDisponiveis = [] } = useAnosDisponiveis();
  const [ano, setAno] = useState(anoAtual);
  const [semestre, setSemestre] = useState(new Date().getMonth() < 6 ? '1' : '2');

  const meses = SEMESTRES.find(s => s.value === semestre)!.meses;
  const { data: kpis = [], isLoading } = useKPIsVendedorSemestre(ano, meses);

  const totais = useMemo(() => calcularMedidas(kpis), [kpis]);

  const rateio = useMemo(() => {
    return kpis
      .map(v => {
        const percFaturamento = totais.vlrNF > 0 ? v.vlr_nf / totais.vlrNF : 0;
        const vlrFlexPago = totais.vlrSaldoFlex * percFaturamento;
        return {
          repres_vend: v.repres_vend,
          nome_rep: v.nome_rep,
          vlrNF: v.vlr_nf,
          percFaturamento,
          vlrFlexPago,
        };
      })
      .sort((a, b) => b.vlrFlexPago - a.vlrFlexPago);
  }, [kpis, totais]);

  const anosParaExibir = anosDisponiveis.length > 0 ? anosDisponiveis : [anoAtual - 1, anoAtual];

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="bg-primary/15 rounded-lg p-2.5 border border-primary/30">
          <Wallet className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Flex Semestral</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rateio do Saldo Flex acumulado no semestre entre os vendedores, proporcional ao faturamento
          </p>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="bg-card border border-border/60 rounded-lg p-4 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-xs text-muted-foreground font-medium">Ano</label>
          <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {anosParaExibir.map(a => (
                <SelectItem key={a} value={String(a)}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 min-w-[220px]">
          <label className="text-xs text-muted-foreground font-medium">Semestre</label>
          <Select value={semestre} onValueChange={setSemestre}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEMESTRES.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="self-end text-xs text-muted-foreground ml-auto">
          {rateio.length} vendedores no período
        </span>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <div className="bg-card border border-border/60 rounded-lg p-4 flex flex-col gap-2">
          <span className="text-xs text-muted-foreground tracking-widest uppercase font-medium">Faturamento do Semestre</span>
          <p className="text-2xl font-bold tabular-nums font-mono">{formatCurrency(totais.vlrNF)}</p>
        </div>
        <div className="bg-card border border-border/60 rounded-lg p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground tracking-widest uppercase font-medium">Saldo Flex a Distribuir</span>
            <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <p className={`text-2xl font-bold tabular-nums font-mono ${totais.vlrSaldoFlex >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
            {formatCurrency(totais.vlrSaldoFlex)}
          </p>
          <p className="text-xs text-muted-foreground">excedente não usado para completar 5% de comissão no semestre</p>
        </div>
        <div className="bg-card border border-border/60 rounded-lg p-4 flex flex-col gap-2">
          <span className="text-xs text-muted-foreground tracking-widest uppercase font-medium">Vendedores</span>
          <p className="text-2xl font-bold tabular-nums font-mono">{rateio.length}</p>
        </div>
      </div>

      {/* ── Tabela de Rateio ── */}
      <div className="bg-card border border-border/60 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60">
          <h3 className="text-sm font-semibold">Rateio do Flex por Vendedor</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Flex pago = Saldo Flex do semestre × (faturamento do vendedor ÷ faturamento total da empresa)
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50">
                {['Vendedor', 'Faturamento', '% Faturamento', 'Flex a Receber'].map(h => (
                  <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-muted-foreground tracking-wide whitespace-nowrap ${h === 'Vendedor' ? 'text-left' : 'text-right'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rateio.map((v, i) => (
                <tr
                  key={v.repres_vend}
                  onClick={() => navigate(`/vendedor/${v.repres_vend}`)}
                  className={`border-b transition-colors hover:bg-secondary/30 cursor-pointer group ${i % 2 === 1 ? 'bg-secondary/10' : ''}`}
                >
                  <td className="px-4 py-3 font-medium text-primary group-hover:text-primary/80 transition-colors">{v.nome_rep}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono">{formatCurrency(v.vlrNF)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono text-muted-foreground">{formatPercent(v.percFaturamento)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-mono font-semibold text-primary">{formatCurrency(v.vlrFlexPago)}</td>
                </tr>
              ))}
              {rateio.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum vendedor com faturamento no período
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-secondary/30 font-bold">
                <td className="px-4 py-3">Total</td>
                <td className="px-4 py-3 text-right tabular-nums font-mono">{formatCurrency(totais.vlrNF)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-mono">100,00%</td>
                <td className="px-4 py-3 text-right tabular-nums font-mono text-primary">{formatCurrency(totais.vlrSaldoFlex)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
