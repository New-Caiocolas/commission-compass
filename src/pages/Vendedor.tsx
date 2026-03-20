import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, ComposedChart, Area, ReferenceLine, Cell,
} from 'recharts';
import { useVendedorData } from '@/hooks/useVendedorData';
import { useApuracao } from '@/hooks/useApuracao';
import { useAuth } from '@/contexts/AuthContext';
import { useFiltros } from '@/contexts/FiltrosContext';
import { FiltrosMes } from '@/components/dashboard/FiltrosMes';
import { formatCurrency, formatPercent, formatDate } from '@/utils/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const CHART_STYLE = {
  grid: 'hsl(215 25% 27%)',
  tick: { fill: 'hsl(215 20% 65%)', fontSize: 11 },
  tooltip: {
    contentStyle: { background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8 },
    labelStyle: { color: 'hsl(210 40% 96%)' },
  },
};

// Cores para os clientes no gráfico empilhado
const CLIENTE_CORES = [
  'hsl(var(--primary))',
  'hsl(217 91% 60%)',
  'hsl(38 92% 50%)',
  'hsl(270 70% 60%)',
  'hsl(142 71% 45%)',
];

export default function Vendedor() {
  const { represVend } = useParams<{ represVend: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  // Se não houver parâmetro na URL (rota /dashboard), usa o repres_vend do perfil
  const represVendNum = represVend ? Number(represVend) : (profile?.repres_vend ?? 0);
  const isVendedor = profile?.cargo === 'vendedor';

  const { porVendedor } = useApuracao();
  const { meses } = useFiltros();
  const {
    registros, calcTotal: calc, porMes,
    topClientes = [], clientesComDevolucao = [], fatPorClientePorMes = [],
    isLoading,
  } = useVendedorData(represVendNum);

  const nomeRep = registros[0]?.nome_rep ?? `Rep. ${represVend}`;
  const naMeta = calc.percComissaoFinal >= 0.05;

  // Top 5 clientes para o gráfico de linha
  const top5Nomes = (topClientes ?? []).slice(0, 5).map(c => c.nomeCliente);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  const kpisVendedor = [
    { label: 'Faturamento', value: formatCurrency(calc.vlrNF) },
    { label: 'Comissão NF', value: formatCurrency(calc.vlrComissaoNF) },
    { label: 'Excedente NF', value: formatCurrency(calc.vlrExcedenteNF) },
    { label: 'Despesa c/ Frete', value: formatCurrency(calc.vlrDespTotalFrete) },
    { label: 'Excedente Flex', value: formatCurrency(calc.vlrExcedenteFlex) },
    { label: 'Aproveitamento Flex', value: formatCurrency(calc.vlrAproveitamentoFlex) },
    { label: 'Saldo Flex', value: formatCurrency(calc.vlrSaldoFlex) },
    { label: '% Comissão Final', value: formatPercent(calc.percComissaoFinal) },
    { label: 'Vlr Comissão Final', value: formatCurrency(calc.vlrComissaoFinal), highlight: true },
  ];

  const kpisCompletos = [
    { label: 'Vlr NF', value: formatCurrency(calc.vlrNF) },
    { label: 'Vlr Comissão NF', value: formatCurrency(calc.vlrComissaoNF) },
    { label: '% Comissão NF', value: formatPercent(calc.percComissaoNF) },
    { label: 'Vlr Excedente NF', value: formatCurrency(calc.vlrExcedenteNF) },
    { label: 'Vlr Frete CTE', value: formatCurrency(calc.vlrFreteCTE) },
    { label: 'Vlr Desp Total c/ Frete', value: formatCurrency(calc.vlrDespTotalFrete) },
    { label: 'Vlr Excedente Flex', value: formatCurrency(calc.vlrExcedenteFlex) },
    { label: '% Excedente Flex', value: formatPercent(calc.percExcedenteFlex) },
    { label: '% Aproveitamento Flex', value: formatPercent(calc.percAproveitamentoFlex) },
    { label: 'Vlr Aproveitamento Flex', value: formatCurrency(calc.vlrAproveitamentoFlex) },
    { label: 'Vlr Saldo Flex', value: formatCurrency(calc.vlrSaldoFlex) },
    { label: '% Comissão Final', value: formatPercent(calc.percComissaoFinal) },
    { label: 'Vlr Comissão Final', value: formatCurrency(calc.vlrComissaoFinal), highlight: true },
  ];

  const cards = isVendedor ? kpisVendedor : kpisCompletos;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="bg-card border border-border/60 rounded-lg px-4 py-3 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {!isVendedor && (
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}

          {!isVendedor ? (
            <Select value={String(represVendNum)} onValueChange={v => navigate(`/vendedor/${v}`)}>
              <SelectTrigger className="w-64 font-semibold text-base">
                <SelectValue placeholder="Selecionar vendedor" />
              </SelectTrigger>
              <SelectContent>
                {[...porVendedor]
                  .sort((a, b) => a.nomeRep.localeCompare(b.nomeRep))
                  .map(v => (
                    <SelectItem key={v.represVend} value={String(v.represVend)}>
                      {v.nomeRep}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-lg font-bold">{nomeRep}</h1>
                <p className="text-xs text-muted-foreground">Seus resultados</p>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                naMeta
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                {naMeta ? '✓ Meta atingida' : '⚠ Abaixo da meta'}
              </span>
            </div>
          )}

          {meses.length > 0 && (
            <span className="text-xs text-muted-foreground font-mono ml-auto">
              {meses.length} {meses.length === 1 ? 'mês' : 'meses'} selecionados
            </span>
          )}
        </div>
        <div className="h-px bg-border/40" />
        <FiltrosMes />
      </div>

      {/* ── Destaque Comissão Final — só vendedor ── */}
      {isVendedor && (
        <div className={`rounded-xl border p-6 flex flex-col sm:flex-row items-center justify-between gap-4 ${
          naMeta ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'
        }`}>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Comissão Final do Período</p>
            <p className={`text-4xl font-bold tabular-nums font-mono ${naMeta ? 'text-emerald-400' : 'text-amber-400'}`}>
              {formatCurrency(calc.vlrComissaoFinal)}
            </p>
          </div>
          <div className="text-center sm:text-right">
            <p className="text-sm text-muted-foreground mb-1">% Comissão Final</p>
            <p className={`text-4xl font-bold tabular-nums font-mono ${naMeta ? 'text-emerald-400' : 'text-amber-400'}`}>
              {formatPercent(calc.percComissaoFinal)}
            </p>
            <div className="mt-2 w-48 h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${naMeta ? 'bg-emerald-400' : 'bg-amber-400'}`}
                style={{ width: `${Math.min(100, calc.percComissaoFinal / 0.05 * 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">meta: 5,00%</p>
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3">
        {cards.map(c => (
          <div key={c.label} className={`bg-card border rounded-lg p-3 ${c.highlight ? 'border-primary ring-1 ring-primary/30' : 'border-border/60'}`}>
            <p className={`text-lg font-bold tabular-nums ${c.highlight ? 'text-primary' : ''}`}>{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      {/* ── Gráficos de comissão ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4">Vlr NF vs Comissão Final por Mês</h2>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={porMes}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} />
              <XAxis dataKey="mes" tick={CHART_STYLE.tick} />
              <YAxis yAxisId="left" tick={CHART_STYLE.tick} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...CHART_STYLE.tooltip} formatter={(value: number, name: string) => [formatCurrency(value), name === 'vlrNF' ? 'Vlr NF' : 'Comissão Final']} />
              <Bar yAxisId="left" dataKey="vlrNF" fill="hsl(215 25% 40%)" radius={[3, 3, 0, 0]} name="vlrNF" />
              <Area yAxisId="left" type="monotone" dataKey="vlrComissaoFinal" fill="hsl(217 91% 60% / 0.15)" stroke="hsl(217 91% 60%)" strokeWidth={2} dot={{ r: 3, fill: 'hsl(217 91% 60%)' }} name="vlrComissaoFinal" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4">% Comissão Final por Mês</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={porMes}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} />
              <XAxis dataKey="mes" tick={CHART_STYLE.tick} />
              <YAxis tick={CHART_STYLE.tick} tickFormatter={v => `${(v * 100).toFixed(1)}%`} domain={[0, 'auto']} />
              <Tooltip {...CHART_STYLE.tooltip} formatter={(value: number) => [formatPercent(value), '% Comissão Final']} />
              <ReferenceLine y={0.05} stroke="hsl(var(--primary))" strokeDasharray="4 2" label={{ value: 'Meta 5%', fill: 'hsl(var(--primary))', fontSize: 10, position: 'insideTopRight' }} />
              <Line type="monotone" dataKey="percComissaoFinal" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={{ r: 4, fill: 'hsl(142 71% 45%)' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {!isVendedor && (
          <div className="bg-card border rounded-lg p-4 lg:col-span-2">
            <h2 className="text-sm font-semibold mb-4">Frete CTE vs Despesa Acessória por Mês</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porMes}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} />
                <XAxis dataKey="mes" tick={CHART_STYLE.tick} />
                <YAxis tick={CHART_STYLE.tick} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...CHART_STYLE.tooltip} formatter={(value: number, name: string) => [formatCurrency(value), name === 'vlrFreteCTE' ? 'Frete CTE' : 'Desp Acessória']} />
                <Bar dataKey="vlrFreteCTE" fill="hsl(38 92% 50%)" radius={[3, 3, 0, 0]} name="vlrFreteCTE" />
                <Bar dataKey="vlrFreteDespAcessoria" fill="hsl(0 72% 51%)" radius={[3, 3, 0, 0]} name="vlrFreteDespAcessoria" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Gráficos de clientes ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">

        {/* Top 10 clientes por faturamento */}
        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-1">Top Clientes por Faturamento</h2>
          <p className="text-xs text-muted-foreground mb-4">Top 10 clientes no período</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={topClientes.map(c => ({ ...c, nomeCliente: c.nomeCliente.length > 18 ? c.nomeCliente.slice(0, 18) + '…' : c.nomeCliente }))}
              layout="vertical"
              margin={{ left: 0, right: 50, top: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} horizontal={false} />
              <XAxis type="number" tick={CHART_STYLE.tick} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="nomeCliente" tick={{ ...CHART_STYLE.tick, fontSize: 10 }} width={130} axisLine={false} tickLine={false} />
              <Tooltip {...CHART_STYLE.tooltip} formatter={(v: number) => [formatCurrency(v), 'Faturamento']} />
              <Bar dataKey="vlrNF" name="Faturamento" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {topClientes.map((entry, i) => (
                  <Cell key={i} fill={entry.temDevolucao ? 'hsl(38 92% 50%)' : 'hsl(var(--primary))'} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-amber-400 shrink-0" />
            Amarelo = cliente com devolução
          </p>
        </div>

        {/* Clientes com devolução */}
        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-1">Clientes com Devolução</h2>
          <p className="text-xs text-muted-foreground mb-4">
            {clientesComDevolucao.length === 0
              ? 'Nenhuma devolução no período 🎉'
              : `${clientesComDevolucao.length} cliente${clientesComDevolucao.length > 1 ? 's' : ''} com glosa`}
          </p>
          {clientesComDevolucao.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={clientesComDevolucao.slice(0, 10).map(c => ({ ...c, nomeCliente: c.nomeCliente.length > 18 ? c.nomeCliente.slice(0, 18) + '…' : c.nomeCliente }))}
                layout="vertical"
                margin={{ left: 0, right: 50, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} horizontal={false} />
                <XAxis type="number" tick={CHART_STYLE.tick} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="nomeCliente" tick={{ ...CHART_STYLE.tick, fontSize: 10 }} width={130} axisLine={false} tickLine={false} />
                <Tooltip {...CHART_STYLE.tooltip} formatter={(v: number, name: string) => [formatCurrency(v), name === 'vlrNF' ? 'Faturamento' : 'Devolução']} />
                <Bar dataKey="vlrNF" name="vlrNF" fill="hsl(215 25% 40%)" radius={[0, 4, 4, 0]} maxBarSize={20} />
                <Bar dataKey="vlrNegativo" name="vlrNegativo" fill="hsl(0 72% 51%)" radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
              Sem devoluções no período selecionado
            </div>
          )}
        </div>

        {/* Faturamento dos top 5 clientes por mês */}
        <div className="bg-card border rounded-lg p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-1">Faturamento por Cliente ao Longo do Tempo</h2>
          <p className="text-xs text-muted-foreground mb-4">Top 5 clientes por mês</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={fatPorClientePorMes} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} vertical={false} />
              <XAxis dataKey="mes" tick={CHART_STYLE.tick} axisLine={false} tickLine={false} />
              <YAxis tick={CHART_STYLE.tick} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip {...CHART_STYLE.tooltip} formatter={(v: number, name: string) => [formatCurrency(v), name]} />
              {top5Nomes.map((nome, i) => (
                <Bar key={nome} dataKey={nome} stackId="a" fill={CLIENTE_CORES[i]} radius={i === top5Nomes.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} maxBarSize={60} />
              ))}
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-3">
            {top5Nomes.map((nome, i) => (
              <div key={nome} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: CLIENTE_CORES[i] }} />
                <span className="truncate max-w-[120px]">{nome}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabela de NFs ── */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">Notas Fiscais</h2>
          <span className="text-xs font-mono text-muted-foreground">{registros.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50">
                <th className="text-left px-4 py-2 text-muted-foreground font-semibold">Num.NF</th>
                <th className="text-left px-4 py-2 text-muted-foreground font-semibold">Cliente</th>
                <th className="text-left px-4 py-2 text-muted-foreground font-semibold">Dt Pag</th>
                <th className="text-right px-4 py-2 text-muted-foreground font-semibold">Prc NF</th>
                <th className="text-right px-4 py-2 text-muted-foreground font-semibold">Vlr Ajustada</th>
                <th className="text-right px-4 py-2 text-muted-foreground font-semibold">Vlr Excedente</th>
                {!isVendedor && <th className="text-right px-4 py-2 text-muted-foreground font-semibold">Frete CTE</th>}
              </tr>
            </thead>
            <tbody>
              {registros.map((r, i) => (
                <tr key={r.id} className={`border-b hover:bg-secondary/30 transition-colors ${i % 2 === 1 ? 'bg-table-row-alt' : ''}`}>
                  <td className="px-4 py-2">{r.num_nf}</td>
                  <td className="px-4 py-2">{r.nome_cliente}</td>
                  <td className="px-4 py-2">{formatDate(r.dt_pag)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.prc_nf)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.vlr_ajustada)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.vlr_exced)}</td>
                  {!isVendedor && <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.vlr_frete)}</td>}
                </tr>
              ))}
              {registros.length === 0 && (
                <tr>
                  <td colSpan={isVendedor ? 6 : 7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum registro encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}