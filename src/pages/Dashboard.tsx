import { Truck, Receipt, Wallet, Percent } from 'lucide-react';
import { useApuracao } from '@/hooks/useApuracao';
import { KPICard } from '@/components/dashboard/KPICard';
import { FiltrosAno } from '@/components/dashboard/FiltrosAno';
import { FiltrosMes } from '@/components/dashboard/FiltrosMes';
import { TabelaVendedores } from '@/components/dashboard/TabelaVendedores';
import { formatCurrency } from '@/utils/formatters';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { totais, porVendedor, anosDisponiveis, isLoading } = useApuracao();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-full max-w-2xl" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 bg-card border rounded-lg p-4">
        <FiltrosAno anosDisponiveis={anosDisponiveis} />
        <FiltrosMes />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Truck} label="Soma de Vlr Frete CTE" value={formatCurrency(totais.vlrFreteCTE)} />
        <KPICard icon={Receipt} label="Soma de Vlr Frete (Desp. Acessória)" value={formatCurrency(totais.vlrFreteDespAcessoria)} />
        <KPICard
          icon={Wallet}
          label="Vlr Saldo Flex"
          value={formatCurrency(totais.vlrSaldoFlex)}
          valueColor={totais.vlrSaldoFlex >= 0 ? 'positive' : 'negative'}
        />
        <KPICard icon={Percent} label="Soma de Desconto 1" value={formatCurrency(totais.somaDesconto1)} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Resumo por Vendedor</h2>
        <TabelaVendedores vendedores={porVendedor} totais={totais} />
      </div>
    </div>
  );
}
