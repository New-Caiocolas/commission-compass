import { useNavigate } from 'react-router-dom';
import { VendedorResumo, CalculosResult } from '@/utils/calculos';
import { formatCurrency, formatPercent } from '@/utils/formatters';

interface Props {
  vendedores: VendedorResumo[];
  totais: CalculosResult;
}

export function TabelaVendedores({ vendedores, totais }: Props) {
  const navigate = useNavigate();

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/50">
              <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Rep.</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">$ Liquidado</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Frete</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">Desc. Fin.</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">% Com.</th>
              <th className="text-right px-4 py-3 font-semibold text-muted-foreground">$ Com.</th>
            </tr>
          </thead>
          <tbody>
            {vendedores.map((v, i) => (
              <tr
                key={v.represVend}
                onClick={() => navigate(`/vendedor/${v.represVend}`)}
                className={`border-b cursor-pointer transition-colors hover:bg-table-hover ${
                  i % 2 === 1 ? 'bg-table-row-alt' : ''
                }`}
              >
                <td className="px-4 py-3 font-medium text-primary">{v.nomeRep}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(v.calculos.vlrNF)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(v.calculos.vlrFreteCTE)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(v.calculos.vlrFreteDespAcessoria)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatPercent(v.calculos.percComissaoFinal)}</td>
                <td className={`px-4 py-3 text-right tabular-nums font-semibold ${v.calculos.vlrComissaoFinal >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(v.calculos.vlrComissaoFinal)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-secondary/30 font-bold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(totais.vlrNF)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(totais.vlrFreteCTE)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(totais.vlrFreteDespAcessoria)}</td>
              <td className="px-4 py-3 text-right tabular-nums">{formatPercent(totais.percComissaoFinal)}</td>
              <td className={`px-4 py-3 text-right tabular-nums ${totais.vlrComissaoFinal >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(totais.vlrComissaoFinal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
