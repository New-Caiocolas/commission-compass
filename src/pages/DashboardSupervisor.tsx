import { useMemo, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useApuracao } from '@/hooks/useApuracao';
import { useAuth } from '@/contexts/AuthContext';
import { useFiltros } from '@/contexts/FiltrosContext';
import { FiltrosAno } from '@/components/dashboard/FiltrosAno';
import { FiltrosMes } from '@/components/dashboard/FiltrosMes';
import { calcularMedidas } from '@/utils/calculos';
import { formatCurrency, formatPercent, MESES } from '@/utils/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList, Cell } from 'recharts';
import { ChevronLeft, ChevronRight, Camera, FileText, TrendingUp, DollarSign, AlertTriangle, Receipt, Percent, PiggyBank, Zap } from 'lucide-react';

interface VendedorFoto { repres_vend: number; foto_url: string | null; }

function useFotosVendedores(ids: number[]) {
  return useQuery({
    queryKey: ['fotos-vendedores', ids],
    queryFn: async () => {
      if (!ids.length) return [] as VendedorFoto[];
      const { data, error } = await supabase.from('profiles' as never).select('repres_vend, foto_url').in('repres_vend', ids);
      if (error) throw error;
      return (data || []) as VendedorFoto[];
    },
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}

function useEvolucaoMensalVendedor(anos: number[], meses: number[], represVend: number | null) {
  return useQuery({
    queryKey: ["evolucao-mensal-vendedor", anos, meses, represVend],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_evolucao_mensal_vendedor" as never, {
        anos_filtro: anos,
        repres_vend_filtro: represVend,
        meses_filtro: meses.length > 0 && meses.length < 12 ? meses : null,
      } as never);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: anos.length > 0 && represVend != null,
    staleTime: 1000 * 60 * 2,
  });
}

function VendedorFotoPanel({ nomeRep, represVend, fotoUrl, canEdit }: {
  nomeRep: string; represVend: number; fotoUrl?: string | null; canEdit: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const initiais = nomeRep.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${represVend}.${ext}`;
      await supabase.storage.from('vendedores-fotos').upload(path, file, { upsert: true });
      const { data: urlData } = supabase.storage.from('vendedores-fotos').getPublicUrl(path);
      await supabase.from('profiles' as never).update({ foto_url: urlData.publicUrl } as never).eq('repres_vend', represVend);
      qc.invalidateQueries({ queryKey: ['fotos-vendedores'] });
    } finally { setUploading(false); }
  };

  return (
    <div className="relative group flex flex-col items-center justify-center h-full bg-secondary/30 rounded-xl border border-border/60 overflow-hidden">
      {fotoUrl ? (
        <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-primary/40 shadow-xl">
          <img src={fotoUrl} alt={nomeRep} className="w-full h-full object-cover object-top" />
        </div>
      ) : (
        <div className="w-40 h-40 rounded-full bg-secondary border-4 border-border flex items-center justify-center shadow-xl">
          <span className="text-5xl font-bold text-muted-foreground">{initiais}</span>
        </div>
      )}
      <p className="mt-4 text-base font-bold text-center px-3 leading-tight">{nomeRep}</p>
      {canEdit && (
        <>
          <button onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-colors border border-white/10">
            {uploading
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Camera className="h-3.5 w-3.5 text-white" />}
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
        </>
      )}
    </div>
  );
}

const CustomBarLabel = ({ x, y, width, value }: any) => {
  if (!value) return null;
  return (
    <text x={x + width / 2} y={y - 4} fill="hsl(var(--foreground))" textAnchor="middle" fontSize={10} fontFamily="monospace">
      {formatCurrency(value)}
    </text>
  );
};

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-2.5 text-xs shadow-xl">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-bold" style={{ color: p.color }}>{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

function CardVendedorFull({ vendedor, fotoUrl, evolucao, todosVendedores, canEdit, onVerDetalhes, total, idx, totalVendedores }: {
  vendedor: any; fotoUrl?: string | null; evolucao: any[];
  todosVendedores: any[];
  canEdit: boolean; onVerDetalhes: () => void;
  total: number; idx: number; totalVendedores: number;
}) {
  const c = calcularMedidas([vendedor]);
  const naMeta = c.percComissaoFinal >= 0.05;
  const qtdNfs = Number(vendedor.qtd_nfs || 0);
  const ticketMedio = qtdNfs > 0 ? c.vlrNF / qtdNfs : 0;
  const percDevolucoes = c.vlrComissaoAjustada > 0 ? c.vlrNegativo / c.vlrComissaoAjustada : 0;

  const chartData = evolucao.map(r => ({ label: MESES[r.mes - 1], valor: Number(r.vlr_comissao) || 0 }));
  const fatData = evolucao.map(r => ({ label: MESES[r.mes - 1], valor: Number(r.vlr_nf) || 0 }));

  const topVendedores = [...todosVendedores]
    .sort((a, b) => b.calculos.vlrNF - a.calculos.vlrNF)
    .slice(0, 8)
    .map(v => ({ nome: v.nomeRep.split(' ')[0], valor: v.calculos.vlrNF, ativo: v.represVend === vendedor.repres_vend }));

  const maxFat = topVendedores[0]?.valor || 1;

  return (
    <div className="flex flex-col h-full gap-2.5">

      {/* ── LINHA 1: KPIs principais ── */}
      <div className="grid grid-cols-4 gap-2.5 shrink-0">
        {[
          { icon: DollarSign, label: 'Notas Liquidadas', value: formatCurrency(c.vlrNF), color: 'text-emerald-400' },
          { icon: FileText, label: 'Notas Emitidas', value: String(qtdNfs), color: 'text-foreground' },
          { icon: TrendingUp, label: 'Comissão Final', value: formatCurrency(c.vlrComissaoFinal), color: naMeta ? 'text-primary' : 'text-amber-400' },
          { icon: AlertTriangle, label: 'Devoluções', value: formatCurrency(c.vlrNegativo), color: c.vlrNegativo > 0 ? 'text-destructive' : 'text-muted-foreground' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{label}</p>
              <p className={`text-base font-bold tabular-nums font-mono leading-tight ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── LINHA 2: KPIs secundários ── */}
      <div className="grid grid-cols-4 gap-2.5 shrink-0">
        {[
          {
            icon: Receipt,
            label: 'Ticket Médio',
            value: ticketMedio > 0 ? formatCurrency(ticketMedio) : '—',
            sub: `${qtdNfs} NFs`,
            color: 'text-foreground',
          },
          {
            icon: Percent,
            label: '% Devoluções',
            value: formatPercent(percDevolucoes),
            sub: percDevolucoes > 0.1 ? '⚠ Acima de 10%' : 'Dentro do limite',
            color: percDevolucoes > 0.1 ? 'text-destructive' : 'text-emerald-400',
          },
          {
            icon: PiggyBank,
            label: 'Saldo Flex',
            value: formatCurrency(c.vlrSaldoFlex),
            sub: `Excedente: ${formatCurrency(c.vlrExcedenteFlex)}`,
            color: c.vlrSaldoFlex >= 0 ? 'text-primary' : 'text-destructive',
          },
          {
            icon: Zap,
            label: 'Aproveitamento Flex',
            value: formatPercent(c.percAproveitamentoFlex),
            sub: formatCurrency(c.vlrAproveitamentoFlex),
            color: c.percAproveitamentoFlex > 0 ? 'text-emerald-400' : 'text-muted-foreground',
          },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="bg-secondary/40 border border-border/40 rounded-xl px-3.5 py-2.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center shrink-0">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{label}</p>
              <p className={`text-sm font-bold tabular-nums font-mono leading-tight ${color}`}>{value}</p>
              {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* ── LINHA 3: Foto + Gráficos + Ranking ── */}
      <div className="flex-1 grid grid-cols-[200px_1fr_210px] gap-2.5 min-h-0">

        {/* Foto */}
        <VendedorFotoPanel
          nomeRep={vendedor.nome_rep}
          represVend={vendedor.repres_vend}
          fotoUrl={fotoUrl}
          canEdit={canEdit}
        />

        {/* Dois gráficos empilhados */}
        <div className="flex flex-col gap-2.5 min-h-0">
          <div className="bg-card border border-border/60 rounded-xl p-3.5 flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Comissão por Mês</p>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                naMeta ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-amber-400 border-amber-500/30 bg-amber-500/10'
              }`}>
                {naMeta ? '✓ Meta' : '⚠ Abaixo'} — {formatPercent(c.percComissaoFinal)}
              </span>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 18, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="valor" name="Comissão" radius={[4, 4, 0, 0]} maxBarSize={50}>
                    {chartData.map((_, i) => <Cell key={i} fill="hsl(var(--primary))" fillOpacity={0.85} />)}
                    <LabelList content={<CustomBarLabel />} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card border border-border/60 rounded-xl p-3.5 flex flex-col flex-1 min-h-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 shrink-0">Faturamento por Mês</p>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fatData} margin={{ top: 18, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="valor" name="Faturamento" radius={[4, 4, 0, 0]} maxBarSize={50}>
                    {fatData.map((_, i) => <Cell key={i} fill="hsl(217 91% 50%)" fillOpacity={0.85} />)}
                    <LabelList content={<CustomBarLabel />} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Coluna direita: Top Vendedores + Resumo Meta */}
        <div className="flex flex-col gap-2.5 min-h-0">

          {/* Top Vendedores */}
          <div className="bg-card border border-border/60 rounded-xl p-3.5 flex-1 flex flex-col min-h-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 shrink-0">
              Top Vendedores
            </p>
            <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
              {topVendedores.map((v, i) => {
                const medalha = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                return (
                  <div key={v.nome} className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      {medalha
                        ? <span className="text-sm shrink-0">{medalha}</span>
                        : <span className="w-4 text-xs text-muted-foreground font-mono text-center shrink-0">{i + 1}</span>}
                      <span className={`text-xs font-medium truncate flex-1 ${v.ativo ? 'text-primary font-bold' : 'text-foreground'}`}>
                        {v.nome}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground shrink-0">{formatCurrency(v.valor)}</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden ml-5">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : v.ativo ? 'bg-primary' : 'bg-muted-foreground/40'
                        }`}
                        style={{ width: `${(v.valor / maxFat) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resumo da Meta */}
          <div className="bg-card border border-border/60 rounded-xl p-3.5 shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2.5">
              Resumo da Meta
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">% Comissão NF</span>
                <span className="text-xs font-mono font-bold">{formatPercent(c.percComissaoNF)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">+ Flex</span>
                <span className="text-xs font-mono font-bold text-primary">{formatPercent(c.percAproveitamentoFlex)}</span>
              </div>
              <div className="h-px bg-border/60" />
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold">= % Final</span>
                <span className={`text-base font-bold font-mono ${naMeta ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {formatPercent(c.percComissaoFinal)}
                </span>
              </div>
            </div>
            <div className="mt-2">
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${naMeta ? 'bg-emerald-400' : 'bg-amber-400'}`}
                  style={{ width: `${Math.min(100, c.percComissaoFinal / 0.05 * 100)}%` }} />
              </div>
              <p className="text-xs text-muted-foreground text-right mt-1">meta: 5,00%</p>
            </div>
            <button onClick={onVerDetalhes}
              className="mt-2 w-full text-xs text-muted-foreground hover:text-primary transition-colors underline underline-offset-2">
              Ver detalhes completos →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardSupervisor() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { anos, meses } = useFiltros();
  const { porVendedor, totais, anosDisponiveis, isLoading } = useApuracao();
  const [idx, setIdx] = useState(0);

  const vendedores = useMemo(
    () => [...porVendedor].sort((a, b) => b.calculos.vlrComissaoFinal - a.calculos.vlrComissaoFinal),
    [porVendedor],
  );

  const represVendIds = useMemo(() => vendedores.map(v => v.represVend), [vendedores]);
  const vendedorAtual = vendedores[idx];
  const { data: fotos = [] } = useFotosVendedores(represVendIds);
  const { data: evolucao = [] } = useEvolucaoMensalVendedor(anos, meses, vendedorAtual?.represVend ?? null);

  const fotoMap = useMemo(() => {
    const m = new Map<number, string | null>();
    fotos.forEach((f: VendedorFoto) => m.set(f.repres_vend, f.foto_url));
    return m;
  }, [fotos]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setIdx(i => (i - 1 + vendedores.length) % vendedores.length);
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % vendedores.length);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [vendedores.length]);

  const isAdmin = profile?.cargo === 'administrador';

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-[calc(100vh-200px)] w-full rounded-xl" />
    </div>
  );

  if (!vendedorAtual) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
      Nenhum vendedor vinculado à sua equipe.
    </div>
  );

  const vendedorData = {
    nome_rep: vendedorAtual.nomeRep,
    repres_vend: vendedorAtual.represVend,
    qtd_nfs: vendedorAtual.qtdNfs ?? 0,
    vlr_nf: vendedorAtual.calculos.vlrNF,
    vlr_comissao_ajustada: vendedorAtual.calculos.vlrComissaoAjustada,
    vlr_negativo: vendedorAtual.calculos.vlrNegativo,
    vlr_excedente_nf: vendedorAtual.calculos.vlrExcedenteNF,
    vlr_frete_cte: vendedorAtual.calculos.vlrFreteCTE,
    vlr_frete_desp: vendedorAtual.calculos.vlrFreteDespAcessoria,
    desconto_1: vendedorAtual.calculos.somaDesconto1,
  };

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-4rem)] overflow-hidden">
      <div className="bg-card border border-border/60 rounded-lg px-4 py-3 space-y-2.5 shrink-0">
        <FiltrosAno anosDisponiveis={anosDisponiveis} />
        <div className="h-px bg-border/40" />
        <FiltrosMes />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {vendedores.map((v, i) => (
          <button key={v.represVend} onClick={() => setIdx(i)} title={v.nomeRep}
            className={`h-1.5 rounded-full transition-all duration-200 ${i === idx ? 'bg-primary w-8' : 'bg-secondary w-4 hover:bg-primary/40'}`}
          />
        ))}
        <span className="ml-auto text-xs text-muted-foreground font-mono">← → para navegar</span>
      </div>

      <div className="relative flex-1 min-h-0">
        <button onClick={() => setIdx(i => (i - 1 + vendedores.length) % vendedores.length)}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20 w-9 h-9 rounded-full bg-card border border-border/60 shadow-xl flex items-center justify-center hover:bg-secondary transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>

        <CardVendedorFull
          key={vendedorAtual.represVend}
          vendedor={vendedorData}
          fotoUrl={fotoMap.get(vendedorAtual.represVend)}
          evolucao={evolucao}
          todosVendedores={vendedores}
          canEdit={isAdmin}
          onVerDetalhes={() => navigate(`/vendedor/${vendedorAtual.represVend}`)}
          total={totais.vlrNF}
          idx={idx}
          totalVendedores={vendedores.length}
        />

        <button onClick={() => setIdx(i => (i + 1) % vendedores.length)}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20 w-9 h-9 rounded-full bg-card border border-border/60 shadow-xl flex items-center justify-center hover:bg-secondary transition-colors">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
