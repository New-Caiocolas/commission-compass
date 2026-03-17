import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend, ComposedChart, Area,
} from 'recharts';
import { useVendedorData } from '@/hooks/useVendedorData';
import { formatCurrency, formatPercent, formatDate } from '@/utils/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

const CHART_STYLE = {
  grid: 'hsl(215 25% 27%)',
  tick: { fill: 'hsl(215 20% 65%)', fontSize: 11 },
  tooltip: {
    contentStyle: { background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8 },
    labelStyle: { color: 'hsl(210 40% 96%)' },
  },
};

export default function Vendedor() {
  const { represVend } = useParams<{ represVend: string }>();
  const navigate = useNavigate();
  const represVendNum = Number(represVend);
  const { registros, calcTotal: calc, porMes, isLoading } = useVendedorData(represVendNum);

  // Nome do representante vem dos próprios registros
  const nomeRep = registros[0]?.nome_rep ?? `Rep. ${represVend}`;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
      </div>
    );
  }

  const cards: { label: string; value: string; highlight?: boolean }[] = [
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">{nomeRep}</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {cards.map(c => (
          <div key={c.label} className={`bg-card border rounded-lg p-3 ${c.highlight ? 'border-primary ring-1 ring-primary/30' : ''}`}>
            <p className={`text-lg font-bold tabular-nums ${c.highlight ? 'text-primary' : ''}`}>{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Gráfico 1 — Vlr NF vs Comissão Final */}
        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4">Vlr NF vs Comissão Final por Mês</h2>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={porMes}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} />
              <XAxis dataKey="mes" tick={CHART_STYLE.tick} />
              <YAxis
                yAxisId="left"
                tick={CHART_STYLE.tick}
                tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                {...CHART_STYLE.tooltip}
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name === 'vlrNF' ? 'Vlr NF' : 'Comissão Final',
                ]}
              />
              <Legend
                formatter={v => v === 'vlrNF' ? 'Vlr NF' : 'Comissão Final'}
                wrapperStyle={{ fontSize: 11, color: 'hsl(215 20% 65%)' }}
              />
              <Bar yAxisId="left" dataKey="vlrNF" fill="hsl(215 25% 40%)" radius={[3, 3, 0, 0]} name="vlrNF" />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="vlrComissaoFinal"
                fill="hsl(217 91% 60% / 0.15)"
                stroke="hsl(217 91% 60%)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'hsl(217 91% 60%)' }}
                name="vlrComissaoFinal"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico 2 — % Comissão Final por mês */}
        <div className="bg-card border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4">% Comissão Final por Mês</h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={porMes}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} />
              <XAxis dataKey="mes" tick={CHART_STYLE.tick} />
              <YAxis
                tick={CHART_STYLE.tick}
                tickFormatter={v => `${(v * 100).toFixed(1)}%`}
                domain={[0, 'auto']}
              />
              {/* Linha de referência 5% */}
              <Tooltip
                {...CHART_STYLE.tooltip}
                formatter={(value: number) => [formatPercent(value), '% Comissão Final']}
              />
              <Line
                type="monotone"
                dataKey="percComissaoFinal"
                stroke="hsl(142 71% 45%)"
                strokeWidth={2}
                dot={{ r: 4, fill: 'hsl(142 71% 45%)' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico 3 — Frete CTE vs Desp Acessória */}
        <div className="bg-card border rounded-lg p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-4">Frete CTE vs Despesa Acessória por Mês</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={porMes}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_STYLE.grid} />
              <XAxis dataKey="mes" tick={CHART_STYLE.tick} />
              <YAxis
                tick={CHART_STYLE.tick}
                tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                {...CHART_STYLE.tooltip}
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name === 'vlrFreteCTE' ? 'Frete CTE' : 'Desp Acessória',
                ]}
              />
              <Legend
                formatter={v => v === 'vlrFreteCTE' ? 'Frete CTE' : 'Desp Acessória'}
                wrapperStyle={{ fontSize: 11, color: 'hsl(215 20% 65%)' }}
              />
              <Bar dataKey="vlrFreteCTE" fill="hsl(38 92% 50%)" radius={[3, 3, 0, 0]} name="vlrFreteCTE" />
              <Bar dataKey="vlrFreteDespAcessoria" fill="hsl(0 72% 51%)" radius={[3, 3, 0, 0]} name="vlrFreteDespAcessoria" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela de NFs */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <h2 className="text-sm font-semibold p-4 border-b">Notas Fiscais</h2>
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
                <th className="text-right px-4 py-2 text-muted-foreground font-semibold">Frete CTE</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r, i) => (
                <tr key={r.id} className={`border-b ${i % 2 === 1 ? 'bg-table-row-alt' : ''}`}>
                  <td className="px-4 py-2">{r.num_nf}</td>
                  <td className="px-4 py-2">{r.nome_cliente}</td>
                  <td className="px-4 py-2">{formatDate(r.dt_pag)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.prc_nf)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.vlr_ajustada)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.vlr_exced)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.vlr_frete)}</td>
                </tr>
              ))}
              {registros.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
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
