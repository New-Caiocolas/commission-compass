import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useFiltros } from '@/contexts/FiltrosContext';
import { FiltrosAno } from '@/components/dashboard/FiltrosAno';
import { FiltrosMes } from '@/components/dashboard/FiltrosMes';
import { useApuracao } from '@/hooks/useApuracao';
import { calcularMedidas } from '@/utils/calculos';
import { formatCurrency, formatPercent, MESES } from '@/utils/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip as UiTooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  DollarSign, FileText, Users, TrendingUp,
  TrendingDown, Truck, AlertTriangle, Award,
  BarChart2, Table2,
} from 'lucide-react';

// ── Tipos ───────────────────────────────────────────────────────────────────
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

interface EvolucaoMensal {
  ano: number;
  mes: number;
  vlr_nf: number;
  vlr_comissao: number;
  vlr_frete: number;
  vlr_negativo: number;
  qtd_nfs: number;
}

const EXCLUIR = ['FUNCIONARIO', 'Padrão Empresa'];

// ── Hooks ───────────────────────────────────────────────────────────────────
function useKPIsVendedor(anos: number[], meses: number[]) {
  return useQuery({
    queryKey: ['kpis-vendedor', anos, meses],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_kpis_vendedor', {
        anos_filtro: anos,
        meses_filtro: meses.length > 0 ? meses : undefined,
      });
      if (error) throw error;
      return (data as KPIVendedor[])
        .filter(r => r.nome_rep)
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
    enabled: anos.length > 0,
    staleTime: 1000 * 60 * 2,
  });
}

function useEvolucaoMensal(anos: number[], meses: number[]) {
  return useQuery({
    queryKey: ['evolucao-mensal', anos, meses],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_evolucao_mensal', {
        anos_filtro: anos,
        meses_filtro: meses.length > 0 ? meses : undefined,
      });
      if (error) throw error;
      return (data as EvolucaoMensal[]).map(r => ({
        ...r,
        vlr_nf: Number(r.vlr_nf) || 0,
        vlr_comissao: Number(r.vlr_comissao) || 0,
        vlr_frete: Number(r.vlr_frete) || 0,
        vlr_negativo: Number(r.vlr_negativo) || 0,
        qtd_nfs: Number(r.qtd_nfs) || 0,
      }));
    },
    enabled: anos.length > 0,
    staleTime: 1000 * 60 * 2,
  });
}

// ── Componentes auxiliares ──────────────────────────────────────────────────
function Tip({ content, children }: { content?: string; children: React.ReactNode }) {
  if (!content) return <>{children}</>;
  return (
    <UiTooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-xs">{content}</TooltipContent>
    </UiTooltip>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'default', tip }: {
  icon: any; label: string; value: string; sub?: string; tip?: string;
  color?: 'default' | 'positive' | 'negative' | 'warning';
}) {
  const colors = { default: 'text-foreground', positive: 'text-emerald-400', negative: 'text-destructive', warning: 'text-yellow-400' };
  return (
    <div className="bg-card border border-border/60 rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground tracking-widest uppercase font-medium">{label}</span>
        <Tip content={tip}>
          <div className="bg-secondary rounded-md p-1.5 cursor-help">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </Tip>
      </div>
      <p className={`text-2xl font-bold tabular-nums font-mono ${colors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs space-y-1 shadow-xl">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-semibold" style={{ color: p.color }}>
            {typeof p.value === 'number' && p.value > 100 ? formatCurrency(p.value) : typeof p.value === 'number' ? p.value.toFixed(0) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Aba: Visão Geral ────────────────────────────────────────────────────────
function AbaVisaoGeral({ totais, kpis, evolucaoFiltrada, totalNFs, totalClientes, ticketMedio, totalFrete, fretePercent, glosaPercent }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">Visão Geral</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <StatCard icon={DollarSign} label="Faturamento Total" value={formatCurrency(totais.vlrNF)} sub="soma de Prc NF" color="positive" tip="Soma do valor de todas as notas fiscais liquidadas no período." />
          <StatCard icon={TrendingUp} label="Comissão Total" value={formatCurrency(totais.vlrComissaoFinal)} sub="comissão final paga" tip="Valor final de comissão paga após ajustes, glosas e aproveitamento flex." />
          <StatCard icon={FileText} label="NFs Liquidadas" value={totalNFs.toLocaleString('pt-BR')} sub={`ticket médio ${formatCurrency(ticketMedio)}`} tip="Quantidade total de NFs. Ticket médio = faturamento / qtd NFs." />
          <StatCard icon={Users} label="Clientes Ativos" value={totalClientes.toLocaleString('pt-BR')} sub="clientes distintos" tip="Clientes com pelo menos uma NF liquidada no período." />
          <StatCard icon={Truck} label="Custo de Frete" value={formatPercent(fretePercent)} sub={formatCurrency(totalFrete)} color={fretePercent > 0.05 ? 'negative' : 'default'} tip="Percentual do frete sobre o faturamento. Acima de 5% é elevado." />
          <StatCard icon={AlertTriangle} label="Impacto de Glosas" value={formatPercent(glosaPercent)} sub={formatCurrency(totais.vlrNegativo) + ' em estornos'} color={glosaPercent > 0.10 ? 'negative' : 'default'} tip="Percentual de devoluções/estornos sobre a comissão ajustada. Acima de 10% é alerta." />
          <StatCard icon={TrendingDown} label="Saldo Flex" value={formatCurrency(totais.vlrSaldoFlex)} sub="excedente não utilizado" color={totais.vlrSaldoFlex >= 0 ? 'positive' : 'negative'} tip="Excedente de NF menos o valor aproveitado para atingir 5% de comissão." />
          <StatCard icon={Award} label="Vendedores Ativos" value={String(kpis.length)} sub={`${kpis.filter((v: KPIVendedor) => calcularMedidas([v]).percComissaoFinal >= 0.05).length} na meta de 5%`} tip="Total de vendedores com NFs no período." />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        <div className="bg-card border border-border/60 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60">
            <h3 className="text-sm font-semibold">Evolução Mensal — Faturamento</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Faturamento liquidado e comissão por mês</p>
          </div>
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={evolucaoFiltrada} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="vlr_nf" name="Faturamento" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} opacity={0.8} />
                <Bar dataKey="vlr_comissao" name="Comissão" fill="hsl(158 60% 40%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border/60 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60">
            <h3 className="text-sm font-semibold">Evolução Mensal — Volume e Risco</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Quantidade de NFs e impacto de glosas</p>
          </div>
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucaoFiltrada}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="qtd_nfs" name="Qtd NFs" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="vlr_negativo" name="Glosas R$" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Aba: KPIs por Vendedor ──────────────────────────────────────────────────
function AbaKPIsVendedor({ kpisSorted, totais, totalNFs, ticketMedio, fretePercent, glosaPercent, navigate }: any) {
  return (
    <div className="bg-card border border-border/60 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">KPIs por Vendedor</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Faturamento, comissão, ticket médio, carteira e custos — clique para detalhar</p>
        </div>
        <span className="text-xs font-mono text-muted-foreground">{kpisSorted.length} vendedores</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/50">
              {['Vendedor', 'Faturamento', '% Com.', '$ Com.', 'Devoluções %', 'NFs', 'Clientes', 'Ticket Médio', 'Frete %'].map((h, idx) => (
                <th key={h} className={`px-2 md:px-4 py-2.5 text-xs font-semibold text-muted-foreground tracking-wide whitespace-nowrap ${h === 'Vendedor' ? 'text-left' : 'text-right'} ${idx >= 5 ? 'hidden lg:table-cell' : ''}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kpisSorted.map((v: KPIVendedor, i: number) => {
              const c = calcularMedidas([v]);
              const percComissao = c.percComissaoFinal;
              const comissaoLiq = c.vlrComissaoFinal;
              const glosaPerc = v.vlr_comissao_ajustada > 0 ? v.vlr_negativo / v.vlr_comissao_ajustada : 0;
              const ticketMedioV = v.qtd_nfs > 0 ? v.vlr_nf / v.qtd_nfs : 0;
              const fretePerc = v.vlr_nf > 0 ? (v.vlr_frete_cte + v.vlr_frete_desp) / v.vlr_nf : 0;
              const naMeta = percComissao >= 0.05;

              return (
                <tr
                  key={v.repres_vend}
                  onClick={() => navigate(`/vendedor/${v.repres_vend}`)}
                  className={`border-b transition-colors hover:bg-secondary/30 cursor-pointer group ${i % 2 === 1 ? 'bg-secondary/10' : ''}`}
                >
                  <td className="px-2 md:px-4 py-3 font-medium truncate max-w-[120px] md:max-w-none text-primary group-hover:text-primary/80 transition-colors">{v.nome_rep}</td>
                  <td className="px-2 md:px-4 py-3 text-right tabular-nums font-mono">{formatCurrency(v.vlr_nf)}</td>
                  <td className={`px-2 md:px-4 py-3 text-right tabular-nums font-mono font-semibold ${naMeta ? 'text-emerald-400' : 'text-yellow-400'}`}>{formatPercent(percComissao)}</td>
                  <td className="px-2 md:px-4 py-3 text-right tabular-nums font-mono text-primary font-semibold">{formatCurrency(comissaoLiq)}</td>
                  <td className={`px-2 md:px-4 py-3 text-right tabular-nums font-mono ${glosaPerc > 0.10 ? 'text-destructive' : 'text-muted-foreground'}`}>{formatPercent(glosaPerc)}</td>
                  <td className="hidden lg:table-cell px-4 py-3 text-right tabular-nums font-mono text-muted-foreground">{v.qtd_nfs.toLocaleString('pt-BR')}</td>
                  <td className="hidden lg:table-cell px-4 py-3 text-right tabular-nums font-mono text-muted-foreground">{v.qtd_clientes.toLocaleString('pt-BR')}</td>
                  <td className="hidden lg:table-cell px-4 py-3 text-right tabular-nums font-mono text-muted-foreground">{formatCurrency(ticketMedioV)}</td>
                  <td className={`hidden lg:table-cell px-4 py-3 text-right tabular-nums font-mono ${fretePerc > 0.05 ? 'text-destructive' : 'text-muted-foreground'}`}>{formatPercent(fretePerc)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-secondary/30 font-bold">
              <td className="px-2 md:px-4 py-3">Total</td>
              <td className="px-2 md:px-4 py-3 text-right tabular-nums font-mono">{formatCurrency(totais.vlrNF)}</td>
              <td className="px-2 md:px-4 py-3 text-right tabular-nums font-mono">{formatPercent(totais.percComissaoFinal)}</td>
              <td className="px-2 md:px-4 py-3 text-right tabular-nums font-mono text-primary">{formatCurrency(totais.vlrComissaoFinal)}</td>
              <td className="px-2 md:px-4 py-3 text-right tabular-nums font-mono">{formatPercent(glosaPercent)}</td>
              <td className="hidden lg:table-cell px-4 py-3 text-right tabular-nums font-mono">{totalNFs.toLocaleString('pt-BR')}</td>
              <td className="hidden lg:table-cell px-4 py-3 text-right tabular-nums font-mono">—</td>
              <td className="hidden lg:table-cell px-4 py-3 text-right tabular-nums font-mono">{formatCurrency(ticketMedio)}</td>
              <td className="hidden lg:table-cell px-4 py-3 text-right tabular-nums font-mono">{formatPercent(fretePercent)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Página Principal ────────────────────────────────────────────────────────
export default function Executivo() {
  const navigate = useNavigate();
  const { anos, meses } = useFiltros();
  const { anosDisponiveis, totais } = useApuracao();
  const { data: kpis = [], isLoading: loadingKpis } = useKPIsVendedor(anos, meses);
  const { data: evolucao = [], isLoading: loadingEvolucao } = useEvolucaoMensal(anos, meses);
  const [abaAtiva, setAbaAtiva] = useState<'visao-geral' | 'kpis-vendedor'>('visao-geral');

  const evolucaoFiltrada = useMemo(() => evolucao.map(r => ({
    ...r,
    label: `${MESES[r.mes - 1]}/${String(r.ano).slice(2)}`,
  })), [evolucao]);

  const { totalNFs, totalClientes, ticketMedio, totalFrete, fretePercent, glosaPercent } = useMemo(() => {
    const nfs = kpis.reduce((s, r) => s + r.qtd_nfs, 0);
    const clientes = kpis.reduce((s, r) => s + r.qtd_clientes, 0);
    const frete = totais.vlrFreteCTE + totais.vlrFreteDespAcessoria;
    return {
      totalNFs: nfs,
      totalClientes: clientes,
      ticketMedio: nfs > 0 ? totais.vlrNF / nfs : 0,
      totalFrete: frete,
      fretePercent: totais.vlrNF > 0 ? frete / totais.vlrNF : 0,
      glosaPercent: totais.vlrComissaoAjustada > 0 ? totais.vlrNegativo / totais.vlrComissaoAjustada : 0,
    };
  }, [kpis, totais]);

  const kpisSorted = useMemo(
    () => kpis.filter(r => !EXCLUIR.includes(r.nome_rep)).sort((a, b) => b.vlr_nf - a.vlr_nf),
    [kpis],
  );

  const isLoading = loadingKpis || loadingEvolucao;

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-12 w-72 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Filtros ── */}
      <div className="bg-card border border-border/60 rounded-lg px-4 py-3 space-y-2.5">
        <FiltrosAno anosDisponiveis={anosDisponiveis} />
        <div className="h-px bg-border/40" />
        <FiltrosMes />
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-secondary/50 border border-border/60 rounded-lg p-1 w-fit">
        <button
          onClick={() => setAbaAtiva('visao-geral')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
            abaAtiva === 'visao-geral'
              ? 'bg-card border border-border/60 text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart2 className="h-4 w-4" />
          Visão Geral
        </button>
        <button
          onClick={() => setAbaAtiva('kpis-vendedor')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
            abaAtiva === 'kpis-vendedor'
              ? 'bg-card border border-border/60 text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Table2 className="h-4 w-4" />
          KPIs por Vendedor
          <span className="ml-1 text-xs font-mono bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">
            {kpisSorted.length}
          </span>
        </button>
      </div>

      {/* ── Conteúdo da Aba ── */}
      {abaAtiva === 'visao-geral' ? (
        <AbaVisaoGeral
          totais={totais}
          kpis={kpis}
          evolucaoFiltrada={evolucaoFiltrada}
          totalNFs={totalNFs}
          totalClientes={totalClientes}
          ticketMedio={ticketMedio}
          totalFrete={totalFrete}
          fretePercent={fretePercent}
          glosaPercent={glosaPercent}
        />
      ) : (
        <AbaKPIsVendedor
          kpisSorted={kpisSorted}
          totais={totais}
          totalNFs={totalNFs}
          ticketMedio={ticketMedio}
          fretePercent={fretePercent}
          glosaPercent={glosaPercent}
          navigate={navigate}
        />
      )}

    </div>
  );
}
