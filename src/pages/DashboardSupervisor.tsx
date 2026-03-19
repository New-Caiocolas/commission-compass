import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
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
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ComposedChart, Area, Bar,
} from 'recharts';
import {
  ChevronLeft, ChevronRight, Camera, TrendingUp,
  DollarSign, FileText, AlertTriangle, ExternalLink,
  Target, Zap, PiggyBank,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   Hooks de dados
   ───────────────────────────────────────────────────────── */

interface VendedorFoto {
  repres_vend: number;
  foto_url: string | null;
}

function useFotosVendedores(ids: number[]) {
  return useQuery({
    queryKey: ['fotos-vendedores', ids],
    queryFn: async () => {
      if (!ids.length) return [] as VendedorFoto[];
      const { data, error } = await supabase
        .from('profiles' as never)
        .select('repres_vend, foto_url')
        .in('repres_vend', ids);
      if (error) throw error;
      return (data || []) as VendedorFoto[];
    },
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 5,
  });
}

function useEvolucaoMensal(anos: number[], meses: number[]) {
  return useQuery({
    queryKey: ['evolucao-mensal', anos, meses],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_evolucao_mensal', {
        anos_filtro: anos,
        meses_filtro: meses.length > 0 && meses.length < 12 ? meses : null,
      });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: anos.length > 0,
    staleTime: 1000 * 60 * 2,
  });
}

/* ─────────────────────────────────────────────────────────
   Avatar com upload
   ───────────────────────────────────────────────────────── */

function VendedorAvatar({
  nomeRep, represVend, fotoUrl, canEdit,
}: {
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
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative group w-full h-full">
      <div className="w-full h-full flex items-center justify-center overflow-hidden bg-secondary">
        {fotoUrl ? (
          <img src={fotoUrl} alt={nomeRep} className="w-full h-full object-cover object-top" />
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full bg-muted border border-border flex items-center justify-center">
              <span className="text-2xl font-bold text-muted-foreground">{initiais}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">Sem foto</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      {canEdit && (
        <>
          <button
            onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
            className="absolute bottom-2 right-2 z-10 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70 transition-colors border border-white/20"
          >
            <Camera className="h-3.5 w-3.5 text-white" />
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Tooltip do gráfico
   ───────────────────────────────────────────────────────── */

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-2.5 text-xs shadow-lg">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-mono font-semibold" style={{ color: p.color }}>
            {p.value > 100 ? formatCurrency(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────
   KPI Card
   ───────────────────────────────────────────────────────── */

function KpiCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string; color?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <p className={`text-sm font-bold tabular-nums font-mono ${color ?? 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Card principal do vendedor
   ───────────────────────────────────────────────────────── */

function CardVendedorFull({
  vendedor, fotoUrl, evolucao, canEdit, onVerDetalhes, total, idx, totalVendedores,
}: {
  vendedor: any; fotoUrl?: string | null; evolucao: any[];
  canEdit: boolean; onVerDetalhes: () => void;
  total: number; idx: number; totalVendedores: number;
}) {
  const c = calcularMedidas([vendedor]);
  const naMeta = c.percComissaoFinal >= 0.05;
  const barColor = naMeta ? 'hsl(var(--primary))' : 'hsl(var(--warning))';
  const qtdNfs = Number(vendedor.qtd_nfs || 0);
  const ticketMedio = qtdNfs > 0 ? c.vlrNF / qtdNfs : 0;
  const participacao = total > 0 ? (c.vlrNF / total) : 0;

  const evolucaoLabel = evolucao.map(r => ({
    label: MESES[r.mes - 1],
    faturamento: Number(r.vlr_nf) || 0,
    comissao: Number(r.vlr_comissao) || 0,
  }));

  const axisStyle = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };
  const gridColor = 'hsl(var(--border))';

  return (
    <div className="grid grid-cols-[280px_1fr] h-full rounded-xl overflow-hidden border border-border bg-card">

      {/* ── Painel esquerdo: perfil do vendedor ── */}
      <div className="flex flex-col border-r border-border overflow-hidden">

        {/* Foto */}
        <div className="h-52 relative shrink-0">
          <VendedorAvatar
            nomeRep={vendedor.nome_rep}
            represVend={vendedor.repres_vend}
            fotoUrl={fotoUrl}
            canEdit={canEdit}
          />
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent" />
        </div>

        {/* Info */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
          <div>
            <h2 className="text-base font-bold text-foreground truncate">{vendedor.nome_rep}</h2>
            <div className="flex items-center justify-between mt-1.5">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold ${
                naMeta
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : 'bg-amber-500/10 text-amber-500'
              }`}>
                {naMeta ? 'Meta atingida' : 'Abaixo da meta'}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">{idx + 1}/{totalVendedores}</span>
            </div>
          </div>

          {/* Comissão destaque */}
          <div className={`rounded-lg p-3 border ${
            naMeta ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-amber-500/5 border-amber-500/15'
          }`}>
            <p className="text-[11px] text-muted-foreground mb-0.5">% Comissão Final</p>
            <p className={`text-2xl font-bold tabular-nums font-mono ${naMeta ? 'text-emerald-500' : 'text-amber-500'}`}>
              {formatPercent(c.percComissaoFinal)}
            </p>
          </div>

          {/* Participação */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-muted-foreground">Participação na equipe</span>
              <span className="text-[11px] font-mono font-semibold text-foreground">
                {total > 0 ? formatPercent(participacao) : '0%'}
              </span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${total > 0 ? Math.max(2, participacao * 100) : 0}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {formatCurrency(c.vlrNF)} de {formatCurrency(total)}
            </p>
          </div>

          {/* Rentabilidade */}
          <div className="space-y-2">
            <p className="text-[11px] text-muted-foreground font-medium">Rentabilidade</p>
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-muted-foreground">% Comissão NF</span>
                <span className="font-mono font-semibold">{formatPercent(c.percComissaoNF)}</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, c.percComissaoNF / 0.05 * 100)}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-muted-foreground">Aproveitamento Flex</span>
                <span className="font-mono font-semibold text-primary">{formatPercent(c.percAproveitamentoFlex)}</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${Math.min(100, c.percAproveitamentoFlex / 0.05 * 100)}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-auto">
            <button
              onClick={onVerDetalhes}
              className="w-full flex items-center justify-center gap-2 text-xs font-medium py-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver detalhes completos
            </button>
          </div>
        </div>
      </div>

      {/* ── Painel direito: KPIs + gráfico ── */}
      <div className="flex flex-col gap-4 p-4 overflow-y-auto">

        {/* Grid de KPIs */}
        <div className="grid grid-cols-4 gap-3 shrink-0">
          <KpiCard icon={DollarSign} label="Faturamento" value={formatCurrency(c.vlrNF)} color="text-emerald-500" />
          <KpiCard icon={TrendingUp} label="Comissão" value={formatCurrency(c.vlrComissaoFinal)} color={naMeta ? 'text-primary' : 'text-amber-500'} />
          <KpiCard icon={FileText} label="NFs Emitidas" value={String(qtdNfs)} />
          <KpiCard icon={Target} label="Ticket Médio" value={ticketMedio > 0 ? formatCurrency(ticketMedio) : '—'} />
        </div>
        <div className="grid grid-cols-3 gap-3 shrink-0">
          <KpiCard icon={AlertTriangle} label="Devoluções" value={formatCurrency(c.vlrNegativo)} color={c.vlrNegativo > 0 ? 'text-destructive' : 'text-muted-foreground'} />
          <KpiCard icon={Zap} label="Excedente Flex" value={formatCurrency(c.vlrExcedenteFlex)} color={c.vlrExcedenteFlex > 0 ? 'text-primary' : 'text-muted-foreground'} />
          <KpiCard icon={PiggyBank} label="Saldo Flex" value={formatCurrency(c.vlrSaldoFlex)} color={c.vlrSaldoFlex >= 0 ? 'text-emerald-500' : 'text-destructive'} />
        </div>

        {/* Gráfico */}
        <div className="bg-card border border-border rounded-lg p-4 flex-1 min-h-[220px]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground">
              Faturamento vs Comissão por Mês
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm bg-blue-500/80" />
                <span className="text-[10px] text-muted-foreground">Faturamento</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: barColor }} />
                <span className="text-[10px] text-muted-foreground">Comissão</span>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height="85%">
            <ComposedChart data={evolucaoLabel}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} opacity={0.5} />
              <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="faturamento" name="Faturamento" fill="hsl(217 91% 45%)" radius={[4, 4, 0, 0]} opacity={0.85} />
              <Area type="monotone" dataKey="comissao" name="Comissão" fill={barColor} fillOpacity={0.08} stroke={barColor} strokeWidth={2} dot={{ r: 3, fill: barColor }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Página principal
   ───────────────────────────────────────────────────────── */

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
  const { data: fotos = [] } = useFotosVendedores(represVendIds);
  const { data: evolucao = [] } = useEvolucaoMensal(anos, meses);

  const fotoMap = useMemo(() => {
    const m = new Map<number, string | null>();
    fotos.forEach((f: VendedorFoto) => m.set(f.repres_vend, f.foto_url));
    return m;
  }, [fotos]);

  const prev = useCallback(() => setIdx(i => (i - 1 + vendedores.length) % vendedores.length), [vendedores.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % vendedores.length), [vendedores.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [prev, next]);

  const isAdmin = profile?.cargo === 'administrador';
  const vendedorAtual = vendedores[idx];

  if (isLoading) return (
    <div className="space-y-3">
      <Skeleton className="h-14 w-full rounded-lg" />
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
    qtd_nfs: (vendedorAtual as any).qtd_nfs ?? 0,
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

      {/* Filtros */}
      <div className="bg-card border border-border rounded-lg px-4 py-3 space-y-2.5 shrink-0">
        <FiltrosAno anosDisponiveis={anosDisponiveis} />
        <div className="h-px bg-border" />
        <FiltrosMes />
      </div>

      {/* Navegação */}
      <div className="flex items-center gap-1.5 shrink-0 px-0.5">
        {vendedores.map((v, i) => (
          <button key={v.represVend} onClick={() => setIdx(i)} title={v.nomeRep}
            className={`h-1.5 rounded-full transition-all duration-200 ${
              i === idx ? 'bg-primary w-7' : 'bg-border w-3 hover:bg-muted-foreground/40'
            }`}
          />
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
          {idx + 1} / {vendedores.length} &middot; use ← →
        </span>
      </div>

      {/* Card principal */}
      <div className="relative flex-1 min-h-0">
        <button
          onClick={prev}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-8 h-8 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-secondary transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
        </button>

        <div className="h-full" key={vendedorAtual.represVend}>
          <CardVendedorFull
            vendedor={vendedorData}
            fotoUrl={fotoMap.get(vendedorAtual.represVend)}
            evolucao={evolucao}
            canEdit={isAdmin}
            onVerDetalhes={() => navigate(`/vendedor/${vendedorAtual.represVend}`)}
            total={totais.vlrNF}
            idx={idx}
            totalVendedores={vendedores.length}
          />
        </div>

        <button
          onClick={next}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-8 h-8 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-secondary transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
