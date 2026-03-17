import {
  DollarSign, TrendingUp, Percent, Truck, AlertTriangle, Activity,
} from 'lucide-react';
import { useApuracao } from '@/hooks/useApuracao';
import { KPICard } from '@/components/dashboard/KPICard';
import { FiltrosAno } from '@/components/dashboard/FiltrosAno';
import { FiltrosMes } from '@/components/dashboard/FiltrosMes';
import { TabelaVendedores } from '@/components/dashboard/TabelaVendedores';
import { RankingVendedores } from '@/components/dashboard/RankingVendedores';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { totais, porVendedor, anosDisponiveis, isLoading } = useApuracao();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-20 w-full rounded-lg" />
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

  // KPIs derivados
  const totalFrete = totais.vlrFreteCTE + totais.vlrFreteDespAcessoria;
  const fretePercent = totais.vlrNF > 0 ? totalFrete / totais.vlrNF : 0;
  const glosaPercent = totais.vlrComissaoAjustada > 0
    ? totais.vlrNegativo / totais.vlrComissaoAjustada
    : 0;
  const excedentePercent = totais.vlrNF > 0 ? totais.vlrExcedenteNF / totais.vlrNF : 0;

  return (
    <div className="space-y-6">

      {/* ── Filtros ── */}
      <div className="animate-slide-up bg-card border border-border/60 rounded-lg px-4 py-3 space-y-2.5">
        <FiltrosAno anosDisponiveis={anosDisponiveis} />
        <div className="h-px bg-border/40" />
        <FiltrosMes />
      </div>

      {/* ── KPIs — Linha 1: Receita e Comissão ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="animate-slide-up delay-75">
          <KPICard
            icon={DollarSign}
            label="Faturamento Liquidado"
            value={formatCurrency(totais.vlrNF)}
            sublabel="soma de Prc NF"
            highlight
            valueColor="primary"
          />
        </div>

        <div className="animate-slide-up delay-150">
          <KPICard
            icon={TrendingUp}
            label="Comissão Total"
            value={formatCurrency(totais.vlrComissaoFinal)}
            sublabel="comissão final paga"
            valueColor={totais.vlrComissaoFinal >= 0 ? 'positive' : 'negative'}
          />
        </div>

        <div className="animate-slide-up delay-225">
          <KPICard
            icon={Percent}
            label="% Comissão Médio"
            value={formatPercent(totais.percComissaoFinal)}
            sublabel="sobre faturamento liquidado"
          />
        </div>

        {/* ── KPIs — Linha 2: Custos e Risco ── */}
        <div className="animate-slide-up delay-150">
          <KPICard
            icon={Truck}
            label="Custo de Frete"
            value={formatPercent(fretePercent)}
            sublabel={formatCurrency(totalFrete) + ' em frete total'}
            valueColor={fretePercent > 0.05 ? 'negative' : 'default'}
          />
        </div>

        <div className="animate-slide-up delay-225">
          <KPICard
            icon={AlertTriangle}
            label="Impacto de Glosas"
            value={formatPercent(glosaPercent)}
            sublabel={formatCurrency(totais.vlrNegativo) + ' em estornos'}
            valueColor={glosaPercent > 0.10 ? 'negative' : 'default'}
          />
        </div>

        <div className="animate-slide-up delay-300">
          <KPICard
            icon={Activity}
            label="Excedente Flex"
            value={formatPercent(excedentePercent)}
            sublabel={`Saldo: ${formatCurrency(totais.vlrSaldoFlex)}`}
            valueColor={totais.vlrSaldoFlex >= 0 ? 'positive' : 'negative'}
          />
        </div>
      </div>

      {/* ── Ranking + Tabela ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-slide-up delay-225">
        <RankingVendedores vendedores={porVendedor} />
        {/* Tabela ocupa metade em lg e vai full width em mobile */}
        <div className="lg:hidden">
          <TabelaVendedores vendedores={porVendedor} totais={totais} />
        </div>
      </div>

      {/* Tabela full-width em lg+ */}
      <div className="hidden lg:block animate-slide-up delay-300">
        <TabelaVendedores vendedores={porVendedor} totais={totais} />
      </div>

    </div>
  );
}
