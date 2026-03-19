import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Search, Calendar, FileText, DollarSign } from 'lucide-react';

interface ClienteAtivo {
  nome_cliente: string;
  nome_rep: string;
  repres_vend: number;
  ultima_compra: string;
  qtd_nfs: number;
  total_comprado: number;
}

function useClientesAtivos() {
  return useQuery({
    queryKey: ['clientes-ativos'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_clientes_ativos' as never);
      if (error) throw error;
      return (data as ClienteAtivo[]).map(r => ({
        ...r,
        qtd_nfs: Number(r.qtd_nfs) || 0,
        total_comprado: Number(r.total_comprado) || 0,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}

function diasDesdeUltimaCompra(data: string): number {
  const hoje = new Date();
  const ultima = new Date(data);
  return Math.floor((hoje.getTime() - ultima.getTime()) / (1000 * 60 * 60 * 24));
}

function BadgeAtividade({ dias }: { dias: number }) {
  if (dias <= 30) return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
      Ativo
    </span>
  );
  if (dias <= 60) return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
      Morno
    </span>
  );
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/15 text-orange-400 border border-orange-500/30">
      Frio
    </span>
  );
}

export default function ClientesAtivos() {
  const { data: clientes = [], isLoading } = useClientesAtivos();
  const [busca, setBusca] = useState('');
  const [vendedor, setVendedor] = useState('todos');

  const vendedores = useMemo(() => {
    const set = new Map<number, string>();
    clientes.forEach(c => { if (c.repres_vend) set.set(c.repres_vend, c.nome_rep); });
    return Array.from(set.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [clientes]);

  const filtrados = useMemo(() => {
    return clientes.filter(c => {
      if (vendedor !== 'todos' && String(c.repres_vend) !== vendedor) return false;
      if (busca.trim()) {
        const q = busca.toLowerCase();
        if (!c.nome_cliente?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [clientes, vendedor, busca]);

  // KPIs
  const totalClientes = filtrados.length;
  const totalFaturamento = filtrados.reduce((s, c) => s + c.total_comprado, 0);
  const totalNFs = filtrados.reduce((s, c) => s + c.qtd_nfs, 0);
  const ativos30 = filtrados.filter(c => diasDesdeUltimaCompra(c.ultima_compra) <= 30).length;

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
      <Skeleton className="h-96 rounded-lg" />
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="bg-primary/15 rounded-lg p-2.5 border border-primary/30">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Clientes Ativos</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Clientes com compras nos últimos 3 meses — atualizado hoje
          </p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border/60 rounded-lg p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground tracking-widest uppercase font-medium">Total Clientes</span>
            <div className="bg-secondary rounded-md p-1.5"><Users className="h-3.5 w-3.5 text-muted-foreground" /></div>
          </div>
          <p className="text-2xl font-bold tabular-nums font-mono text-primary">{totalClientes.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground">{ativos30} compraram nos últimos 30 dias</p>
        </div>

        <div className="bg-card border border-border/60 rounded-lg p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground tracking-widest uppercase font-medium">Faturamento</span>
            <div className="bg-secondary rounded-md p-1.5"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" /></div>
          </div>
          <p className="text-2xl font-bold tabular-nums font-mono text-emerald-400">{formatCurrency(totalFaturamento)}</p>
          <p className="text-xs text-muted-foreground">nos últimos 3 meses</p>
        </div>

        <div className="bg-card border border-border/60 rounded-lg p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground tracking-widest uppercase font-medium">NFs Emitidas</span>
            <div className="bg-secondary rounded-md p-1.5"><FileText className="h-3.5 w-3.5 text-muted-foreground" /></div>
          </div>
          <p className="text-2xl font-bold tabular-nums font-mono">{totalNFs.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground">ticket médio {formatCurrency(totalNFs > 0 ? totalFaturamento / totalNFs : 0)}</p>
        </div>

        <div className="bg-card border border-border/60 rounded-lg p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground tracking-widest uppercase font-medium">Últ. 30 dias</span>
            <div className="bg-secondary rounded-md p-1.5"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /></div>
          </div>
          <p className="text-2xl font-bold tabular-nums font-mono text-emerald-400">{ativos30}</p>
          <p className="text-xs text-muted-foreground">{totalClientes > 0 ? ((ativos30 / totalClientes) * 100).toFixed(0) : 0}% da base ativa</p>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="bg-card border border-border/60 rounded-lg p-4 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground font-medium">Buscar cliente</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome do cliente..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground font-medium">Vendedor</label>
          <Select value={vendedor} onValueChange={setVendedor}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todos os vendedores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os vendedores</SelectItem>
              {vendedores.map(([id, nome]) => (
                <SelectItem key={id} value={String(id)}>{nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="self-end text-xs text-muted-foreground ml-auto">
          {filtrados.length} clientes encontrados
        </span>
      </div>

      {/* ── Tabela ── */}
      <div className="bg-card border border-border/60 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/50">
                {['Cliente', 'Vendedor', 'Última Compra', 'Status', 'NFs', 'Total Comprado'].map(h => (
                  <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-muted-foreground tracking-wide ${h === 'Cliente' || h === 'Vendedor' ? 'text-left' : 'text-right'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c, i) => {
                const dias = diasDesdeUltimaCompra(c.ultima_compra);
                return (
                  <tr key={`${c.nome_cliente}-${c.repres_vend}`} className={`border-b hover:bg-secondary/30 transition-colors ${i % 2 === 1 ? 'bg-secondary/10' : ''}`}>
                    <td className="px-4 py-3 font-medium max-w-[250px] truncate">{c.nome_cliente}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.nome_rep}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatDate(c.ultima_compra)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end">
                        <BadgeAtividade dias={dias} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-mono text-muted-foreground">{c.qtd_nfs}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-mono font-semibold text-primary">{formatCurrency(c.total_comprado)}</td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum cliente encontrado
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
