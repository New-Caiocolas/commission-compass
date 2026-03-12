import { useState, useMemo } from 'react';
import { Download, Search } from 'lucide-react';
import { useApuracao } from '@/hooks/useApuracao';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const PAGE_SIZE = 50;

export default function Notas() {
  const { dados, isLoading } = useApuracao();
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);

  const filtrados = useMemo(() => {
    if (!busca.trim()) return dados;
    const q = busca.toLowerCase();
    return dados.filter(r =>
      r.num_nf?.toLowerCase().includes(q) ||
      r.nome_cliente?.toLowerCase().includes(q) ||
      r.nome_rep?.toLowerCase().includes(q)
    );
  }, [dados, busca]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginados = filtrados.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE);

  const exportCSV = () => {
    const headers = ['Num.NF', 'Vendedor', 'Cliente', 'Dt Pag', 'Prc NF', 'Vlr Ajustada', 'Vlr Negativa', 'Vlr Excedente', 'Frete CTE', 'Frete Desp.', 'Desconto 1'];
    const rows = filtrados.map(r => [
      r.num_nf, r.nome_rep, r.nome_cliente, r.dt_pag, r.prc_nf, r.vlr_ajustada,
      r.vlr_negativa, r.vlr_exced, r.vlr_frete_cte, r.vlr_frete_desp_acessoria, r.desconto_1,
    ].join(';'));
    const csv = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notas_fiscais.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold flex-1">Detalhes de NFs</h1>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar NF, Cliente ou Vendedor..."
            value={busca}
            onChange={e => { setBusca(e.target.value); setPagina(1); }}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> CSV
        </Button>
      </div>

      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50">
                {['Num.NF', 'Vendedor', 'Cliente', 'Dt Pag', 'Prc NF', 'Vlr Ajustada', 'Vlr Negativa', 'Vlr Excedente', 'Frete CTE', 'Frete Desp.', 'Desconto 1'].map(h => (
                  <th key={h} className={`px-3 py-2 font-semibold text-muted-foreground ${['Prc NF', 'Vlr Ajustada', 'Vlr Negativa', 'Vlr Excedente', 'Frete CTE', 'Frete Desp.', 'Desconto 1'].includes(h) ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginados.map((r, i) => (
                <tr key={r.id} className={`border-b ${i % 2 === 1 ? 'bg-table-row-alt' : ''}`}>
                  <td className="px-3 py-2">{r.num_nf}</td>
                  <td className="px-3 py-2">{r.nome_rep}</td>
                  <td className="px-3 py-2">{r.nome_cliente}</td>
                  <td className="px-3 py-2">{formatDate(r.dt_pag)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.prc_nf)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.vlr_ajustada)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.vlr_negativa)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.vlr_exced)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.vlr_frete_cte)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.vlr_frete_desp_acessoria)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.desconto_1)}</td>
                </tr>
              ))}
              {paginados.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">Nenhum registro encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{filtrados.length} registros — Página {pagina} de {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={pagina >= totalPages} onClick={() => setPagina(p => p + 1)}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}
