import { useParams, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useApuracao } from '@/hooks/useApuracao';
import { calcularMedidas } from '@/utils/calculos';
import { formatCurrency, formatPercent, formatDate, MESES } from '@/utils/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export default function Vendedor() {
  const { nome } = useParams<{ nome: string }>();
  const navigate = useNavigate();
  const { dados, isLoading } = useApuracao();

  const nomeDecoded = decodeURIComponent(nome || '');
  const registros = useMemo(() => dados.filter(r => r.nome_rep === nomeDecoded), [dados, nomeDecoded]);
  const calc = useMemo(() => calcularMedidas(registros), [registros]);

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    registros.forEach(r => {
      if (!r.dt_pag) return;
      const d = new Date(r.dt_pag + 'T00:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + (r.prc_nf || 0));
    });
    // Recalculate per month properly
    const monthGroups = new Map<string, typeof registros>();
    registros.forEach(r => {
      if (!r.dt_pag) return;
      const d = new Date(r.dt_pag + 'T00:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthGroups.has(key)) monthGroups.set(key, []);
      monthGroups.get(key)!.push(r);
    });
    return Array.from(monthGroups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, recs]) => {
        const c = calcularMedidas(recs);
        const [y, m] = key.split('-');
        return { mes: `${MESES[parseInt(m) - 1]}/${y}`, vlrComissaoFinal: c.vlrComissaoFinal };
      });
  }, [registros]);

  if (isLoading) return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}</div>;

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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">{nomeDecoded}</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {cards.map(c => (
          <div key={c.label} className={`bg-card border rounded-lg p-3 ${c.highlight ? 'border-primary ring-1 ring-primary/30' : ''}`}>
            <p className={`text-lg font-bold tabular-nums ${c.highlight ? 'text-primary' : ''}`}>{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-card border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-4">Evolução Mensal — Comissão Final</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 25% 27%)" />
            <XAxis dataKey="mes" tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }} />
            <YAxis tick={{ fill: 'hsl(215 20% 65%)', fontSize: 12 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: 'hsl(217 33% 17%)', border: '1px solid hsl(215 25% 27%)', borderRadius: 8 }}
              labelStyle={{ color: 'hsl(210 40% 96%)' }}
              formatter={(value: number) => [formatCurrency(value), 'Comissão Final']}
            />
            <Bar dataKey="vlrComissaoFinal" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

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
                  <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(r.vlr_frete_cte)}</td>
                </tr>
              ))}
              {registros.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Nenhum registro encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
