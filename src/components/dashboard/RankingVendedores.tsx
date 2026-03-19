import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { VendedorResumo } from '@/utils/calculos';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { ArrowUpRight } from 'lucide-react';

interface Props {
  vendedores: VendedorResumo[];
}

export const RankingVendedores = React.memo(function RankingVendedores({ vendedores }: Props) {
  const navigate = useNavigate();

  const sorted = useMemo(
    () => [...vendedores].sort((a, b) => b.calculos.vlrComissaoFinal - a.calculos.vlrComissaoFinal),
    [vendedores],
  );

  const max = sorted[0]?.calculos.vlrComissaoFinal ?? 1;

  const medalColors = [
    'text-warning border-warning/40 bg-warning/10',   // 1º
    'text-foreground/60 border-border bg-secondary',   // 2º
    'text-orange-400 border-orange-400/40 bg-orange-400/10', // 3º
  ];

  return (
    <div className="bg-card border border-border/60 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide">Ranking por Comissão</h2>
        <span className="text-xs text-muted-foreground font-mono">{sorted.length} vendedores</span>
      </div>

      <div className="divide-y divide-border/40">
        {sorted.map((v, i) => {
          const pct = max > 0 ? (v.calculos.vlrComissaoFinal / max) * 100 : 0;
          const isPositive = v.calculos.vlrComissaoFinal >= 0;
          const fretePercent = v.calculos.vlrNF > 0
            ? (v.calculos.vlrFreteCTE + v.calculos.vlrFreteDespAcessoria) / v.calculos.vlrNF
            : 0;

          return (
            <div
              key={v.represVend}
              onClick={() => navigate(`/vendedor/${v.represVend}`)}
              className="px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-secondary/40 transition-colors group"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {/* Rank badge */}
              <span className={`
                font-mono text-xs font-bold w-7 h-7 rounded flex items-center justify-center shrink-0 border
                ${medalColors[i] ?? 'text-muted-foreground border-border/40 bg-secondary/50'}
              `}>
                {i + 1}
              </span>

              {/* Name + bar */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-sm font-medium truncate text-foreground group-hover:text-primary transition-colors">
                    {v.nomeRep}
                  </span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>

                {/* Progress bar */}
                <div className="h-1 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${isPositive ? 'bg-primary' : 'bg-destructive'}`}
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </div>
              </div>

              {/* Values */}
              <div className="text-right shrink-0 space-y-0.5">
                <p className={`text-sm font-bold font-mono tabular-nums ${isPositive ? 'text-primary' : 'text-destructive'}`}>
                  {formatCurrency(v.calculos.vlrComissaoFinal)}
                </p>
                <div className="flex items-center gap-2 justify-end">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatPercent(v.calculos.percComissaoFinal)}
                  </span>
                  {fretePercent > 0 && (
                    <span className="text-xs text-muted-foreground/60 tabular-nums font-mono">
                      frete {formatPercent(fretePercent)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            Nenhum dado para o período
          </div>
        )}
      </div>
    </div>
  );
});
