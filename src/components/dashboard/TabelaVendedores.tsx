import { useNavigate } from 'react-router-dom';
import { VendedorResumo, CalculosResult } from '@/utils/calculos';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { ArrowUpRight } from 'lucide-react';

interface Props {
  vendedores: VendedorResumo[];
  totais: CalculosResult;
}

export function TabelaVendedores({ vendedores, totais }: Props) {
  const navigate = useNavigate();

  const sorted = [...vendedores].sort(
    (a, b) => b.calculos.vlrComissaoFinal - a.calculos.vlrComissaoFinal
  );

  const maxComissao = sorted[0]?.calculos.vlrComissaoFinal ?? 1;

  const totalFrete = totais.vlrFreteCTE + totais.vlrFreteDespAcessoria;
  const totalFretePercent = totais.vlrNF > 0 ? totalFrete / totais.vlrNF : 0;
  const totalGlosaPercent = totais.vlrComissaoAjustada > 0
    ? totais.vlrNegativo / totais.vlrComissaoAjustada : 0;

  return (
    <div className="bg-card border border-border/60 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide">Resumo por Vendedor</h2>
        <span className="text-xs text-muted-foreground font-mono">{sorted.length} representantes</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-secondary/30">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground tracking-wide uppercase w-6">#</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground tracking-wide uppercase">Representante</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground tracking-wide uppercase">Liquidado</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground tracking-wide uppercase">% Frete</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground tracking-wide uppercase">Glosa</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground tracking-wide uppercase">Desc. Fin.</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground tracking-wide uppercase">% Com.</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground tracking-wide uppercase min-w-[160px]">$ Comissão</th>
            </tr>
          </thead>

          <tbody>
            {sorted.map((v, i) => {
              const fretePercent = v.calculos.vlrNF > 0
                ? (v.calculos.vlrFreteCTE + v.calculos.vlrFreteDespAcessoria) / v.calculos.vlrNF
                : 0;
              const glosaPercent = v.calculos.vlrComissaoAjustada > 0
                ? v.calculos.vlrNegativo / v.calculos.vlrComissaoAjustada
                : 0;
              const barPct = maxComissao > 0
                ? Math.max(2, (v.calculos.vlrComissaoFinal / maxComissao) * 100)
                : 2;
              const isPositive = v.calculos.vlrComissaoFinal >= 0;

              const highFrete = fretePercent > 0.05;
              const highGlosa = glosaPercent > 0.10;

              return (
                <tr
                  key={v.represVend}
                  onClick={() => navigate(`/vendedor/${v.represVend}`)}
                  className={`border-b border-border/30 cursor-pointer transition-colors hover:bg-secondary/40 group ${
                    i % 2 === 1 ? 'bg-table-row-alt' : ''
                  }`}
                >
                  {/* Rank */}
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{i + 1}</td>

                  {/* Nome */}
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 font-medium text-primary group-hover:text-primary/80 transition-colors">
                      {v.nomeRep}
                      <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                    </span>
                  </td>

                  {/* Liquidado */}
                  <td className="px-4 py-3 text-right tabular-nums font-mono text-xs">
                    {formatCurrency(v.calculos.vlrNF)}
                  </td>

                  {/* % Frete */}
                  <td className={`px-4 py-3 text-right tabular-nums font-mono text-xs ${highFrete ? 'text-warning' : 'text-muted-foreground'}`}>
                    {formatPercent(fretePercent)}
                  </td>

                  {/* Glosa */}
                  <td className={`px-4 py-3 text-right tabular-nums font-mono text-xs ${highGlosa ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {formatPercent(glosaPercent)}
                  </td>

                  {/* Desc. Fin. */}
                  <td className="px-4 py-3 text-right tabular-nums font-mono text-xs text-muted-foreground">
                    {formatCurrency(v.calculos.somaDesconto1)}
                  </td>

                  {/* % Com. */}
                  <td className="px-4 py-3 text-right tabular-nums font-mono text-xs">
                    {formatPercent(v.calculos.percComissaoFinal)}
                  </td>

                  {/* $ Comissão + mini bar */}
                  <td className="px-4 py-3 text-right">
                    <div className="space-y-1">
                      <span className={`tabular-nums font-mono text-xs font-semibold ${isPositive ? 'text-primary' : 'text-destructive'}`}>
                        {formatCurrency(v.calculos.vlrComissaoFinal)}
                      </span>
                      <div className="h-0.5 bg-secondary rounded-full overflow-hidden ml-auto" style={{ width: '80px' }}>
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${isPositive ? 'bg-primary/60' : 'bg-destructive/60'}`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-border bg-secondary/40 font-bold">
              <td className="px-4 py-3 text-xs text-muted-foreground font-mono" />
              <td className="px-4 py-3 text-xs text-muted-foreground font-semibold tracking-wide uppercase">Total</td>
              <td className="px-4 py-3 text-right tabular-nums font-mono text-xs">{formatCurrency(totais.vlrNF)}</td>
              <td className={`px-4 py-3 text-right tabular-nums font-mono text-xs ${totalFretePercent > 0.05 ? 'text-warning' : ''}`}>
                {formatPercent(totalFretePercent)}
              </td>
              <td className={`px-4 py-3 text-right tabular-nums font-mono text-xs ${totalGlosaPercent > 0.10 ? 'text-destructive' : ''}`}>
                {formatPercent(totalGlosaPercent)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-mono text-xs">{formatCurrency(totais.somaDesconto1)}</td>
              <td className="px-4 py-3 text-right tabular-nums font-mono text-xs">{formatPercent(totais.percComissaoFinal)}</td>
              <td className={`px-4 py-3 text-right tabular-nums font-mono text-xs font-bold ${totais.vlrComissaoFinal >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(totais.vlrComissaoFinal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
