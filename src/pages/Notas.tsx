import { useState, useMemo } from 'react';
import { Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ApuracaoRecord } from '@/utils/calculos';

const PAGE_SIZE = 50;

function useNotas() {
  return useQuery({
    queryKey: ['notas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes')
        .select('*')
        .order('dt_pag', { ascending: false })
        .limit(99999);
      if (error) throw error;
      return (data || []) as ApuracaoRecord[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export default function Notas() {
  const { data: notas = [], isLoading } = useNotas();
  const [vendedor, setVendedor] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [pagina, setPagina] = useState(1);

  const vendedores = useMemo(() => {
    const set = new Set<string>();
    notas.forEach(r => { if (r.nome_rep) set.add(r.nome_rep); });
    return Array.from(set).sort();
  }, [notas]);

  const filtrados = useMemo(() => {
    return notas.filter(r => {
      if (vendedor !== 'todos' && r.nome_rep !== vendedor) return false;
      if (dataInicio && r.dt_pag && r.dt_pag < dataInicio) return false;
      if (dataFim && r.dt_pag && r.dt_pag > dataFim) return false;
      return true;
    });
  }, [notas, vendedor, dataInicio, dataFim]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginados = filtrados.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE);

  const resetFiltros = () => {
    setVendedor('todos');
    setDataInicio('');
    setDataFim('');
    setPagina(1);
  };

  const handleFiltroChange = (fn: () => void) => {
    fn();
    setPagina(1);
  };

  const exportCSV = () => {
    const headers = ['Num.NF', 'Vendedor', 'Cliente', 'Dt Pag', 'Prc NF', 'Vlr Ajustada', 'Vlr Negativa', 'Vlr Excedente', 'Frete CTE', 'Frete NF', 'Desconto 1'];
    const rows = filtrados.map(r => [
      r.num_nf, r.nome_rep, r.nome_cliente, r.dt_pag, r.prc_nf, r.vlr_ajustada,
      r.vlr_negativa, r.vlr_exced, r.vlr_frete, r.frete_na_nf, r.desconto_1,
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

  if (isLoading) return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-xl font-bold flex-1">Detalhes de NFs</h1>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> CSV
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-card border rounded-lg p-4 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground font-medium">Vendedor</label>
          <Select value={vendedor} onValueChange={v => handleFiltroChange(() => setVendedor(v))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todos os vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os vendedores</SelectItem>
              {vendedores.map(v => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">Data início</label>
          <Input
            type="date"
            value={dataInicio}
            onChange={e => handleFiltroChange(() => setDataInicio(e.target.value))}
            className="w-40"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">Data fim</label>
          <Input
            type="date"
            value={dataFim}
            onChange={e => handleFiltroChange(() => setDataFim(e.target.value))}
            className="w-40"
          />
        </div>

        {(vendedor !== 'todos' || dataInicio || dataFim) && (
          <Button variant="ghost" size="sm" onClick={resetFiltros} className="self-end">
            Limpar filtros
          </Button>
        )}

        <span className="self-end text-xs text-muted-foreground ml-auto">
          {filtrados.length} registros encontrados
        </span>
      </div>

      {/* Tabela */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50">
                {['Num.NF', 'Vendedor', 'Cliente', 'Dt Pag', 'Prc NF', 'Vlr Ajustada', 'Vlr Negativa', 'Vlr Excedente', 'Frete CTE', 'Frete NF', 'Desconto 1'].map(h => (
                  <th
                    key={h}
                    className={`px-3 py-2 font-semibold text-muted-foreground ${
                      ['Prc NF', 'Vlr Ajustada', 'Vlr Negativa', 'Vlr Excedente', 'Frete CTE', 'Frete NF', 'Desconto 1'].includes(h)
                        ? 'text-right' : 'text-left'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginados.map((r, i) => (
                <tr key={r.id} className={`border-b hover:bg-secondary/30 transition-colors ${i % 2 === 1 ? 'bg-table-row-alt' : ''}`}>
                  <td className="px-3 py-2">{r.num_nf}</td>
                  <td className="px-3 py-2">{r.nome_rep}</td>
                  <td className="px-3 py-2">{r.nome_cliente}</td>
                  <td className="px-3 py-2">{formatDate(r.dt_pag)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.prc_nf)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.vlr_ajustada)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.vlr_negativa)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.vlr_exced)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.vlr_frete)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.frete_na_nf)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.desconto_1)}</td>
                </tr>
              ))}
              {paginados.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum registro encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {filtrados.length} registros — Página {pagina} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={pagina >= totalPages} onClick={() => setPagina(p => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
