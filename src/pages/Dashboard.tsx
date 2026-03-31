import {
  DollarSign, TrendingUp, Percent, Truck, AlertTriangle, Activity,
  Bell, CheckCircle2, XCircle, Info, ChevronRight,
} from 'lucide-react';
import { useApuracao } from '@/hooks/useApuracao';
import { KPICard } from '@/components/dashboard/KPICard';
import { FiltrosAno } from '@/components/dashboard/FiltrosAno';
import { FiltrosMes } from '@/components/dashboard/FiltrosMes';
import { TabelaVendedores } from '@/components/dashboard/TabelaVendedores';
import { RankingVendedores } from '@/components/dashboard/RankingVendedores';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { VendedorResumo, type CalculosResult } from '@/utils/calculos';

// ── Alertas automáticos baseados nos dados ──────────────────────────────────
function gerarAlertas(totais: CalculosResult, porVendedor: VendedorResumo[]) {
  const alertas: { tipo: 'error' | 'warning' | 'success' | 'info'; mensagem: string; detalhe?: string }[] = [];

  // Vendedores com comissão negativa
  const negativos = porVendedor.filter(v => v.calculos.vlrComissaoFinal < 0);
  if (negativos.length > 0) {
    alertas.push({
      tipo: 'error',
      mensagem: `${negativos.length} vendedor${negativos.length > 1 ? 'es' : ''} com comissão negativa`,
      detalhe: negativos.map(v => v.nomeRep).join(', '),
    });
  }

  // Saldo Flex negativo
  if (totais.vlrSaldoFlex < 0) {
    alertas.push({
      tipo: 'warning',
      mensagem: 'Saldo Flex negativo no período',
      detalhe: `${formatCurrency(totais.vlrSaldoFlex)} de saldo`,
    });
  }

  // Impacto de glosas alto (> 10%)
  const glosaPercent = totais.vlrComissaoAjustada > 0
    ? totais.vlrNegativo / totais.vlrComissaoAjustada : 0;
  if (glosaPercent > 0.10) {
    alertas.push({
      tipo: 'warning',
      mensagem: `Impacto de glosas elevado: ${formatPercent(glosaPercent)}`,
      detalhe: `${formatCurrency(totais.vlrNegativo)} em estornos`,
    });
  }

  // Vendedores abaixo de 5% de comissão
  const abaixoMeta = porVendedor.filter(
    v => v.calculos.vlrNF > 1000 && v.calculos.percComissaoFinal < 0.05
  );
  if (abaixoMeta.length > 0) {
    alertas.push({
      tipo: 'info',
      mensagem: `${abaixoMeta.length} vendedor${abaixoMeta.length > 1 ? 'es' : ''} abaixo da meta de 5%`,
      detalhe: abaixoMeta.map(v => `${v.nomeRep} (${formatPercent(v.calculos.percComissaoFinal)})`).join(', '),
    });
  }

  // Tudo certo
  if (alertas.length === 0) {
    alertas.push({
      tipo: 'success',
      mensagem: 'Todos os indicadores dentro do esperado',
      detalhe: 'Nenhuma anomalia detectada no período',
    });
  }

  return alertas;
}

// ── Componente de Alerta ────────────────────────────────────────────────────
function AlertaBanner({ tipo, mensagem, detalhe }: {
  tipo: 'error' | 'warning' | 'success' | 'info';
  mensagem: string;
  detalhe?: string;
}) {
  const styles = {
    error:   { bg: 'bg-destructive/10 border-destructive/30', text: 'text-destructive', icon: XCircle },
    warning: { bg: 'bg-yellow-500/10 border-yellow-500/30',   text: 'text-yellow-400', icon: AlertTriangle },
    success: { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', icon: CheckCircle2 },
    info:    { bg: 'bg-blue-500/10 border-blue-500/30',       text: 'text-blue-400',   icon: Info },
  };

  const s = styles[tipo];
  const Icon = s.icon;

  return (
    <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${s.bg}`}>
      <Icon className={`h-4 w-4 shrink-0 mt-0.5 ${s.text}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${s.text}`}>{mensagem}</p>
        {detalhe && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{detalhe}</p>
        )}
      </div>
    </div>
  );
}

// ── Dashboard ───────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { totais, porVendedor, anosDisponiveis, isLoading } = useApuracao();

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-96 rounded-lg" />
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    );
  }

  const totalFrete = totais.vlrFreteCTE + totais.vlrFreteDespAcessoria;
  const fretePercent = totais.vlrNF > 0 ? totalFrete / totais.vlrNF : 0;
  const glosaPercent = totais.vlrComissaoAjustada > 0
    ? totais.vlrNegativo / totais.vlrComissaoAjustada : 0;
  const excedentePercent = totais.vlrNF > 0 ? totais.vlrExcedenteNF / totais.vlrNF : 0;
  const alertas = gerarAlertas(totais, porVendedor);

  return (
    <div className="space-y-4">

      {/* ── Filtros ── */}
      <div className="animate-slide-up bg-card border border-border/60 rounded-lg px-4 py-3 space-y-2.5">
        <FiltrosAno anosDisponiveis={anosDisponiveis} />
        <div className="h-px bg-border/40" />
        <FiltrosMes />
      </div>

      {/* ── Seção de Alertas/Destaques ── */}
      <div className="animate-slide-up bg-card border border-border/60 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/60 flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
            Alertas do Período
          </span>
          <span className="ml-auto text-xs font-mono text-muted-foreground">
            {alertas.filter(a => a.tipo === 'error' || a.tipo === 'warning').length > 0
              ? `${alertas.filter(a => a.tipo === 'error' || a.tipo === 'warning').length} atenção`
              : 'tudo ok'}
          </span>
        </div>
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          {alertas.map((a, i) => (
            <AlertaBanner key={i} {...a} />
          ))}
        </div>
      </div>

      {/* ── KPIs Linha 1: Receita e Comissão ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <div className="animate-slide-up" style={{ animationDelay: '75ms' }}>
          <KPICard
            icon={DollarSign}
            label="Faturamento Liquidado"
            value={formatCurrency(totais.vlrNF)}
            sublabel="soma de Prc NF"
            highlight
            valueColor="primary"
          />
        </div>
        <div className="animate-slide-up" style={{ animationDelay: '150ms' }}>
          <KPICard
            icon={TrendingUp}
            label="Comissão Total"
            value={formatCurrency(totais.vlrComissaoFinal)}
            sublabel="comissão final paga"
            valueColor={totais.vlrComissaoFinal >= 0 ? 'positive' : 'negative'}
          />
        </div>
        <div className="animate-slide-up" style={{ animationDelay: '225ms' }}>
          <KPICard
            icon={Percent}
            label="% Comissão Médio"
            value={formatPercent(totais.percComissaoFinal)}
            sublabel="sobre faturamento liquidado"
            valueColor={totais.percComissaoFinal >= 0.05 ? 'positive' : 'default'}
          />
        </div>

        {/* ── KPIs Linha 2: Custos e Risco ── */}
        <div className="animate-slide-up" style={{ animationDelay: '150ms' }}>
          <KPICard
            icon={Truck}
            label="Custo de Frete"
            value={formatPercent(fretePercent)}
            sublabel={formatCurrency(totalFrete) + ' em frete total'}
            valueColor={fretePercent > 0.05 ? 'negative' : 'default'}
          />
        </div>
        <div className="animate-slide-up" style={{ animationDelay: '225ms' }}>
          <KPICard
            icon={AlertTriangle}
            label="Impacto de Glosas"
            value={formatPercent(glosaPercent)}
            sublabel={formatCurrency(totais.vlrNegativo) + ' em estornos'}
            valueColor={glosaPercent > 0.10 ? 'negative' : 'default'}
          />
        </div>
        <div className="animate-slide-up" style={{ animationDelay: '300ms' }}>
          <KPICard
            icon={Activity}
            label="Excedente Flex"
            value={formatPercent(excedentePercent)}
            sublabel={`Saldo: ${formatCurrency(totais.vlrSaldoFlex)}`}
            valueColor={totais.vlrSaldoFlex >= 0 ? 'positive' : 'negative'}
          />
        </div>
      </div>

      {/* ── Resumo rápido de performance ── */}
      <div className="animate-slide-up bg-card border border-border/60 rounded-lg overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/60 flex items-center gap-2">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
            Performance por Vendedor
          </span>
          <span className="ml-auto text-xs font-mono text-muted-foreground">
            {porVendedor.filter(v => v.calculos.percComissaoFinal >= 0.05).length} de {porVendedor.length} na meta
          </span>
        </div>
        <div className="p-3 flex flex-wrap gap-2">
          {[...porVendedor]
            .sort((a, b) => b.calculos.percComissaoFinal - a.calculos.percComissaoFinal)
            .map(v => {
              const perc = v.calculos.percComissaoFinal;
              const naMeta = perc >= 0.05;
              const negativo = perc < 0;
              return (
                <div
                  key={v.represVend}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all
                    ${negativo
                      ? 'bg-destructive/10 border-destructive/30 text-destructive'
                      : naMeta
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                    }`}
                >
                  <span className="font-semibold">{v.nomeRep}</span>
                  <span className="opacity-70 font-mono">{formatPercent(perc)}</span>
                </div>
              );
            })}
        </div>
      </div>

      {/* ── Ranking + Tabela ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 animate-slide-up" style={{ animationDelay: '225ms' }}>
        <RankingVendedores vendedores={porVendedor} />
        <div className="lg:hidden">
          <TabelaVendedores vendedores={porVendedor} totais={totais} />
        </div>
      </div>

      <div className="hidden lg:block animate-slide-up" style={{ animationDelay: '300ms' }}>
        <TabelaVendedores vendedores={porVendedor} totais={totais} />
      </div>

    </div>
  );
}
