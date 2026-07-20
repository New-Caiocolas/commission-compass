import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatPercent } from '@/utils/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Legend, ReferenceLine, Cell,
} from 'recharts';
import { Landmark, TrendingUp, TrendingDown, Clock, AlertTriangle, RefreshCw, Scale, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MESES } from '@/utils/formatters';

interface Empresa { id: string; codigo: string; nome: string }
interface Liquidez { total_a_pagar_aberto: number; total_a_receber_aberto: number; saldo_projetado: number }
interface Prazos { pmr_dias: number; pmp_dias: number }
interface Inadimplencia { valor_vencido: number; valor_total_aberto: number; percentual: number }
interface AgingFaixa { faixa: string; valor: number; quantidade: number }

const ORDEM_FAIXAS = ['A vencer', '0-30 dias', '31-60 dias', '61-90 dias', '90+ dias'];

function useEmpresas() {
  return useQuery({
    queryKey: ['financeiro-empresas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_empresas')
        .select('id, codigo, nome')
        .order('nome');
      if (error) throw error;
      return data as Empresa[];
    },
    staleTime: 1000 * 60 * 10,
  });
}

function useKpiFinanceiro(empresaCodigo: string | null) {
  const queryKey = ['kpi-financeiro', empresaCodigo];

  const liquidez = useQuery({
    queryKey: [...queryKey, 'liquidez'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_kpi_financeiro_liquidez', { empresa_codigo: empresaCodigo });
      if (error) throw error;
      const r = (data as Liquidez[])[0];
      return {
        total_a_pagar_aberto: Number(r?.total_a_pagar_aberto) || 0,
        total_a_receber_aberto: Number(r?.total_a_receber_aberto) || 0,
        saldo_projetado: Number(r?.saldo_projetado) || 0,
      };
    },
    staleTime: 1000 * 60 * 2,
  });

  const prazos = useQuery({
    queryKey: [...queryKey, 'prazos'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_kpi_financeiro_prazos', { empresa_codigo: empresaCodigo });
      if (error) throw error;
      const r = (data as Prazos[])[0];
      return { pmr_dias: Number(r?.pmr_dias) || 0, pmp_dias: Number(r?.pmp_dias) || 0 };
    },
    staleTime: 1000 * 60 * 2,
  });

  const inadimplencia = useQuery({
    queryKey: [...queryKey, 'inadimplencia'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_kpi_financeiro_inadimplencia', { empresa_codigo: empresaCodigo });
      if (error) throw error;
      const r = (data as Inadimplencia[])[0];
      return {
        valor_vencido: Number(r?.valor_vencido) || 0,
        valor_total_aberto: Number(r?.valor_total_aberto) || 0,
        percentual: Number(r?.percentual) || 0,
      };
    },
    staleTime: 1000 * 60 * 2,
  });

  const aging = useQuery({
    queryKey: [...queryKey, 'aging'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_kpi_financeiro_aging', { empresa_codigo: empresaCodigo });
      if (error) throw error;
      return (data as AgingFaixa[])
        .map(r => ({ ...r, valor: Number(r.valor) || 0, quantidade: Number(r.quantidade) || 0 }))
        .sort((a, b) => ORDEM_FAIXAS.indexOf(a.faixa) - ORDEM_FAIXAS.indexOf(b.faixa));
    },
    staleTime: 1000 * 60 * 2,
  });

  return { liquidez, prazos, inadimplencia, aging };
}

function useUltimaSync() {
  return useQuery({
    queryKey: ['financeiro-ultima-sync'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financeiro_sync_log')
        .select('executado_em, status, registros')
        .order('executado_em', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
    staleTime: 1000 * 60,
  });
}

function useSyncFinanceiro() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-senior-financeiro', { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      // Resposta por etapa: { contaspagar: {gravados,...}|{erro}, contasreceber: ..., faturamento: ... }
      const etapas = data as Record<string, { gravados?: number; erro?: string }>;
      const gravados = Object.values(etapas).reduce((sum, e) => sum + (e.gravados ?? 0), 0);
      const erros = Object.entries(etapas).filter(([, e]) => e.erro).map(([k]) => k);
      if (gravados === 0 && erros.length > 0) {
        throw new Error(Object.values(etapas).find(e => e.erro)?.erro ?? 'Falha em todas as etapas');
      }
      return { gravados, erros };
    },
    onSuccess: ({ gravados, erros }) => {
      toast({
        title: 'Sincronização concluída!',
        description:
          `${gravados.toLocaleString('pt-BR')} registros atualizados do Senior XT.` +
          (erros.length > 0 ? ` Etapas pendentes: ${erros.join(', ')} (porta ainda não criada?).` : ''),
      });
      queryClient.invalidateQueries({ queryKey: ['kpi-financeiro'] });
      queryClient.invalidateQueries({ queryKey: ['financeiro-ultima-sync'] });
    },
    onError: (err) => {
      toast({
        title: 'Erro na sincronização',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    },
  });
}

interface ResultadoMes { ano: number; mes: number; receita: number; despesa: number; resultado: number }
interface FluxoSemana { semana: string; entradas: number; saidas: number; saldo: number }

function useResultadoMensal(empresaCodigo: string | null) {
  return useQuery({
    queryKey: ['kpi-financeiro', empresaCodigo, 'resultado-mensal'],
    queryFn: async () => {
      // Janela larga (todo o histórico disponível); o recorte de período é feito no cliente.
      const { data, error } = await supabase.rpc('get_kpi_financeiro_resultado', {
        empresa_codigo: empresaCodigo, meses: 36,
      });
      if (error) throw error;
      const agora = new Date();
      return (data as ResultadoMes[]).map(r => ({
        ...r,
        receita: Number(r.receita) || 0,
        despesa: Number(r.despesa) || 0,
        resultado: Number(r.resultado) || 0,
        rotulo: `${MESES[r.mes - 1]}/${String(r.ano).slice(2)}`,
        parcial: r.ano === agora.getFullYear() && r.mes === agora.getMonth() + 1,
      }));
    },
    staleTime: 1000 * 60 * 2,
  });
}

interface ComparativoEmpresa {
  empresa_codigo: string; empresa_nome: string;
  a_pagar_aberto: number; a_receber_aberto: number; saldo_projetado: number;
  inadimplencia_pct: number; pmr_dias: number; pmp_dias: number;
  receita_mes: number; despesa_mes: number; resultado_mes: number; mes_ref: string;
}

function useComparativo() {
  return useQuery({
    queryKey: ['financeiro-comparativo'],
    queryFn: async () => {
      // Sempre todas as empresas — independente do filtro de empresa da página.
      const { data, error } = await supabase.rpc('get_kpi_financeiro_comparativo');
      if (error) throw error;
      return (data as ComparativoEmpresa[]).map(r => ({
        ...r,
        a_pagar_aberto: Number(r.a_pagar_aberto) || 0,
        a_receber_aberto: Number(r.a_receber_aberto) || 0,
        saldo_projetado: Number(r.saldo_projetado) || 0,
        inadimplencia_pct: Number(r.inadimplencia_pct) || 0,
        pmr_dias: Number(r.pmr_dias) || 0,
        pmp_dias: Number(r.pmp_dias) || 0,
        receita_mes: Number(r.receita_mes) || 0,
        despesa_mes: Number(r.despesa_mes) || 0,
        resultado_mes: Number(r.resultado_mes) || 0,
      }));
    },
    staleTime: 1000 * 60 * 2,
  });
}

interface RankingItem { nome: string; valor: number; quantidade: number }

function useTopParceiros(
  empresaCodigo: string | null,
  fn: 'get_kpi_top_devedores' | 'get_kpi_top_fornecedores',
  campoNome: 'cliente' | 'fornecedor',
) {
  return useQuery({
    queryKey: ['kpi-financeiro', empresaCodigo, fn],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)(fn, { empresa_codigo: empresaCodigo, limite: 10 });
      if (error) throw error;
      return (data as Record<string, unknown>[]).map(r => ({
        nome: String(r[campoNome] ?? '(sem nome)'),
        valor: Number(r.valor) || 0,
        quantidade: Number(r.quantidade) || 0,
      })) as RankingItem[];
    },
    staleTime: 1000 * 60 * 2,
  });
}

function useFluxoSemanal(empresaCodigo: string | null, semanas: number) {
  return useQuery({
    queryKey: ['kpi-financeiro', empresaCodigo, 'fluxo-semanal', semanas],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_kpi_financeiro_fluxo_semanal', {
        empresa_codigo: empresaCodigo, semanas,
      });
      if (error) throw error;
      return (data as FluxoSemana[]).map(f => {
        const d = new Date(f.semana + 'T00:00:00');
        return {
          ...f,
          entradas: Number(f.entradas) || 0,
          saidas: Number(f.saidas) || 0,
          saldo: Number(f.saldo) || 0,
          rotulo: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        };
      });
    },
    staleTime: 1000 * 60 * 2,
  });
}

// ── Filtro de período (recorte client-side sobre os meses carregados) ────────
type PeriodoPreset = '6m' | '12m' | 'ano' | 'anoAnterior' | 'tudo' | 'custom';

const PERIODO_OPCOES: { value: PeriodoPreset; label: string }[] = [
  { value: '6m', label: 'Últimos 6 meses' },
  { value: '12m', label: 'Últimos 12 meses' },
  { value: 'ano', label: `Este ano (${new Date().getFullYear()})` },
  { value: 'anoAnterior', label: `Ano passado (${new Date().getFullYear() - 1})` },
  { value: 'tudo', label: 'Tudo' },
  { value: 'custom', label: 'Personalizado…' },
];

/** Converte "YYYY-MM" (input type=month) em chave comparável ano*100+mes. */
const chaveMes = (ano: number, mes: number) => ano * 100 + mes;
const parseMesInput = (s: string): number | null => {
  const [y, m] = s.split('-').map(Number);
  return y && m ? chaveMes(y, m) : null;
};

function rangeDoPeriodo(p: PeriodoPreset, customIni: string, customFim: string): [number, number] {
  const agora = new Date();
  const atual = chaveMes(agora.getFullYear(), agora.getMonth() + 1);
  const mesesAtras = (n: number) => {
    const d = new Date(agora.getFullYear(), agora.getMonth() - n, 1);
    return chaveMes(d.getFullYear(), d.getMonth() + 1);
  };
  switch (p) {
    case '6m': return [mesesAtras(5), atual];
    case '12m': return [mesesAtras(11), atual];
    case 'ano': return [chaveMes(agora.getFullYear(), 1), atual];
    case 'anoAnterior': return [chaveMes(agora.getFullYear() - 1, 1), chaveMes(agora.getFullYear() - 1, 12)];
    case 'tudo': return [0, 999912];
    case 'custom': {
      const ini = parseMesInput(customIni) ?? 0;
      const fim = parseMesInput(customFim) ?? 999912;
      return ini <= fim ? [ini, fim] : [fim, ini];
    }
  }
}

const compactBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL', maximumFractionDigits: 1 }).format(v);

/** Tooltip compartilhado: nome da série + valor em R$, texto em cor de texto (não da série). */
const FinTooltip = ({ active, payload, label }: {
  active?: boolean; label?: string;
  payload?: { name: string; value: number; color?: string }[];
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl space-y-1">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-foreground flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} />
          {p.name}: <span className="font-mono font-semibold">{formatCurrency(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

const legendaTexto = (value: string) => <span className="text-xs text-foreground">{value}</span>;

const truncaNome = (s: string) => (s.length > 22 ? s.slice(0, 21) + '…' : s);

const RankingTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: RankingItem }[] }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl space-y-0.5 max-w-[260px]">
      <p className="font-semibold text-foreground break-words">{item.nome}</p>
      <p className="font-mono font-semibold text-primary">{formatCurrency(item.valor)}</p>
      <p className="text-muted-foreground">{item.quantidade} título{item.quantidade === 1 ? '' : 's'}</p>
    </div>
  );
};

/** Ranking horizontal (Top N por valor). Uma série só — cor única. */
function RankingChart({ data, cor }: { data: RankingItem[]; cor: string }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 30 + 20)}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 12 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" tickFormatter={compactBRL} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis
          type="category"
          dataKey="nome"
          tickFormatter={truncaNome}
          tick={{ fontSize: 11 }}
          stroke="hsl(var(--muted-foreground))"
          width={150}
        />
        <Tooltip content={<RankingTooltip />} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.08)' }} />
        <Bar dataKey="valor" fill={cor} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Explicações dos KPIs (o que é + que decisão apoia) ───────────────────────
interface KpiInfoTexto { oQueE: string; decisao: string }

const KPI_INFO: Record<string, KpiInfoTexto> = {
  receitaMes: {
    oQueE: 'Total faturado em notas fiscais de saída no mês (todas as vendas emitidas, à vista e a prazo).',
    decisao: 'Acompanhar se as vendas sustentam a estrutura de custos do grupo. Queda de receita por 2+ meses seguidos pede ação comercial (campanhas, preços, mix) antes que vire problema de caixa.',
  },
  despesaMes: {
    oQueE: 'Soma dos títulos do contas a pagar liquidados no mês (fornecedores, impostos, folha, serviços).',
    decisao: 'Controlar o ritmo de gastos e antecipar meses de pico — dez/2025 saltou para R$ 3,8M (13º, encargos). Planejar reserva de caixa para esses picos em vez de ser surpreendido.',
  },
  resultadoMes: {
    oQueE: 'Receita faturada menos despesas pagas no mês. É o resultado GERENCIAL (visão de caixa) — não inclui CMV, depreciação nem regime de competência contábil.',
    decisao: 'A resposta direta de "estamos ganhando ou queimando dinheiro?". Margem abaixo de ~10% por vários meses pede revisão de preços ou corte de custos; resultado negativo recorrente é alerta vermelho.',
  },
  resultadoAcumulado: {
    oQueE: 'Soma do resultado gerencial de todos os meses fechados do período selecionado no filtro.',
    decisao: 'A visão de longo prazo: o acumulado do ano diz se o grupo tem fôlego para investir/expandir ou se precisa frear. Use para metas anuais e para comparar anos entre si (filtro "Ano passado").',
  },
  contasPagar: {
    oQueE: 'Total de compromissos assumidos e ainda não pagos (títulos em aberto no contas a pagar).',
    decisao: 'Dimensionar o caixa necessário nas próximas semanas. Se está alto demais frente ao caixa disponível: renegociar prazos com fornecedores, priorizar pagamentos com juros/multa.',
  },
  contasReceber: {
    oQueE: 'Total de vendas a prazo ainda não recebidas (títulos em aberto no contas a receber).',
    decisao: 'É capital do grupo parado na mão de clientes. Se cresce mais rápido que a receita, a política de crédito está frouxa — apertar análise de crédito e prazos concedidos.',
  },
  saldoProjetado: {
    oQueE: 'A receber em aberto menos a pagar em aberto. Se tudo fosse recebido e pago hoje, este seria o efeito líquido no caixa.',
    decisao: 'Negativo significa que os compromissos superam os recebíveis — decidir entre antecipar recebíveis, captar capital de giro ou renegociar vencimentos ANTES do aperto chegar.',
  },
  inadimplencia: {
    oQueE: 'Percentual da carteira de recebíveis que está vencida e não paga (valor vencido ÷ total em aberto).',
    decisao: 'Régua de cobrança e crédito: acima de ~5-10% já pede ação. Os 66% atuais concentram títulos antigos (2019-2020) — decidir entre campanha de cobrança, protesto ou baixa contábil dos incobráveis.',
  },
  pmr: {
    oQueE: 'Prazo Médio de Recebimento: dias médios entre emitir a venda e receber o dinheiro, com base nos títulos recebidos nos últimos 12 meses.',
    decisao: 'Mede quanto tempo você financia o cliente. PMR subindo = caixa apertando mesmo com vendas boas. Meta: manter o PMR menor que o PMP, para os fornecedores financiarem o ciclo em vez de você.',
  },
  pmp: {
    oQueE: 'Prazo Médio de Pagamento: dias médios entre a compra e o pagamento ao fornecedor, com base nos títulos pagos nos últimos 12 meses.',
    decisao: 'Mede o prazo que os fornecedores financiam o grupo. PMP maior que PMR = os fornecedores financiam seu ciclo (bom). PMP menor = você paga antes de receber (pressão no caixa).',
  },
  graficoResultado: {
    oQueE: 'Barras: receita faturada (verde) e despesas pagas (vermelho) por mês. Linha: resultado do mês. Mês atual em tom claro por estar incompleto.',
    decisao: 'Enxergar tendência e sazonalidade: dezembro historicamente vira o mês crítico (13º, encargos). Use para planejar reservas, definir metas mensais e explicar o ano em reunião de diretoria.',
  },
  graficoFluxo: {
    oQueE: 'Vencimentos em aberto agrupados por semana: entradas previstas (a receber) contra saídas previstas (a pagar). Linha = saldo semanal projetado.',
    decisao: 'A pergunta "vai faltar caixa em qual semana?". Semanas vermelhas à frente pedem ação imediata: antecipar recebíveis, postergar pagamentos negociáveis ou reforçar cobrança dos vencidos.',
  },
  graficoAging: {
    oQueE: 'Recebíveis em aberto distribuídos por faixa de atraso: a vencer, 0-30, 31-60, 61-90 e mais de 90 dias.',
    decisao: 'Priorizar a cobrança: títulos até 60 dias têm alta chance de recuperação (cobrança ativa); a faixa 90+ pede decisão dura — protesto, negativação ou baixa. Quanto mais a barra pesa à direita, pior a qualidade da carteira.',
  },
  comparativo: {
    oQueE: 'As 3 empresas do grupo lado a lado nos principais indicadores, sempre com todas visíveis (não segue o filtro de empresa acima).',
    decisao: 'Identificar qual empresa puxa o grupo pra cima ou pra baixo e replicar o que funciona. Diferenças grandes de PMR, inadimplência ou margem entre empresas do mesmo grupo indicam onde agir primeiro.',
  },
  topDevedores: {
    oQueE: 'Os 10 clientes com maior valor de títulos vencidos e não pagos (recebíveis em atraso).',
    decisao: 'É a lista de ligações de cobrança, em ordem de impacto. Concentração em poucos clientes = negociar caso a caso; muitos clientes pequenos = revisar a régua de cobrança automática. Direciona o esforço para onde há mais dinheiro a recuperar.',
  },
  topFornecedores: {
    oQueE: 'Os 10 fornecedores com maior valor de títulos a pagar em aberto.',
    decisao: 'Onde está concentrado o compromisso de caixa. Use para priorizar negociação de prazo/desconto com os maiores e planejar os desembolsos das próximas semanas.',
  },
};

/** Ícone ⓘ que abre o popup explicativo do KPI (clique/toque — funciona no celular). */
function KpiInfo({ titulo, info }: { titulo: string; info: KpiInfoTexto }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Sobre: ${titulo}`}
          className="rounded-md p-1 -m-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={e => e.stopPropagation()}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-xs" align="end">
        <p className="text-sm font-semibold text-foreground mb-1.5">{titulo}</p>
        <p className="text-muted-foreground leading-relaxed mb-3">{info.oQueE}</p>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1">Que decisão apoia</p>
        <p className="text-muted-foreground leading-relaxed">{info.decisao}</p>
      </PopoverContent>
    </Popover>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'default', info }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  color?: 'default' | 'positive' | 'negative' | 'warning';
  info?: KpiInfoTexto;
}) {
  const colors = { default: 'text-foreground', positive: 'text-emerald-400', negative: 'text-destructive', warning: 'text-yellow-400' };
  return (
    <div className="bg-card border border-border/60 rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground tracking-widest uppercase font-medium">{label}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {info && <KpiInfo titulo={label} info={info} />}
          <div className="bg-secondary rounded-md p-1.5">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </div>
      <p className={`text-2xl font-bold tabular-nums font-mono ${colors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const AgingTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      <p className="font-mono font-semibold text-primary">{formatCurrency(payload[0].value)}</p>
    </div>
  );
};

export default function Financeiro() {
  const { data: empresas = [] } = useEmpresas();
  const [empresaCodigo, setEmpresaCodigo] = useState<string>('todas');
  const filtro = empresaCodigo === 'todas' ? null : empresaCodigo;

  const [periodo, setPeriodo] = useState<PeriodoPreset>('12m');
  const [customIni, setCustomIni] = useState('2025-01');
  const [customFim, setCustomFim] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [semanasFluxo, setSemanasFluxo] = useState(8);

  const { liquidez, prazos, inadimplencia, aging } = useKpiFinanceiro(filtro);
  const resultadoMensal = useResultadoMensal(filtro);
  const fluxoSemanal = useFluxoSemanal(filtro, semanasFluxo);
  const comparativo = useComparativo();
  const topDevedores = useTopParceiros(filtro, 'get_kpi_top_devedores', 'cliente');
  const topFornecedores = useTopParceiros(filtro, 'get_kpi_top_fornecedores', 'fornecedor');
  const sync = useSyncFinanceiro();
  const ultimaSync = useUltimaSync();
  const isLoading = liquidez.isLoading || prazos.isLoading || inadimplencia.isLoading || aging.isLoading;

  // Recorte do período selecionado (client-side sobre a janela carregada)
  const [rangeIni, rangeFim] = rangeDoPeriodo(periodo, customIni, customFim);
  const resultadoPeriodo = (resultadoMensal.data ?? []).filter(r => {
    const chave = chaveMes(r.ano, r.mes);
    return chave >= rangeIni && chave <= rangeFim;
  });

  // Último mês FECHADO dentro do período (o mês corrente aparece no gráfico como parcial)
  const mesesFechados = resultadoPeriodo.filter(r => !r.parcial);
  const mesFechado = mesesFechados[mesesFechados.length - 1];
  const margem = mesFechado && mesFechado.receita > 0 ? mesFechado.resultado / mesFechado.receita : null;

  // Acumulado dos meses fechados do período selecionado
  const acumulado = mesesFechados.reduce(
    (acc, r) => ({ receita: acc.receita + r.receita, despesa: acc.despesa + r.despesa, resultado: acc.resultado + r.resultado }),
    { receita: 0, despesa: 0, resultado: 0 },
  );

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-16 w-full rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
      <Skeleton className="h-72 rounded-lg" />
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/15 rounded-lg p-2.5 border border-primary/30">
            <Landmark className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Financeiro</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              KPIs financeiros consolidados do grupo, sincronizados do Senior XT
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${sync.isPending ? 'animate-spin' : ''}`} />
            {sync.isPending ? 'Sincronizando…' : 'Sincronizar agora'}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {sync.isPending
              ? 'Buscando títulos no Senior XT — pode levar ~1 min'
              : ultimaSync.data
                ? `Última sync: ${new Date(ultimaSync.data.executado_em).toLocaleString('pt-BR')} (${ultimaSync.data.registros?.toLocaleString('pt-BR') ?? 0} títulos)`
                : 'Nenhuma sincronização registrada'}
          </span>
        </div>
      </div>

      {/* ── Filtros ── */}
      <div className="bg-card border border-border/60 rounded-lg p-4 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1 min-w-[220px]">
          <label className="text-xs text-muted-foreground font-medium">Empresa</label>
          <Select value={empresaCodigo} onValueChange={setEmpresaCodigo}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Consolidado (todas)</SelectItem>
              {empresas.map(e => (
                <SelectItem key={e.codigo} value={e.codigo}>{e.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1 min-w-[190px]">
          <label className="text-xs text-muted-foreground font-medium">Período (resultado)</label>
          <Select value={periodo} onValueChange={v => setPeriodo(v as PeriodoPreset)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODO_OPCOES.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {periodo === 'custom' && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">De</label>
              <Input
                type="month"
                value={customIni}
                min="2025-01"
                onChange={e => setCustomIni(e.target.value)}
                className="w-[150px]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Até</label>
              <Input
                type="month"
                value={customFim}
                min="2025-01"
                onChange={e => setCustomFim(e.target.value)}
                className="w-[150px]"
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-xs text-muted-foreground font-medium">Fluxo de caixa</label>
          <Select value={String(semanasFluxo)} onValueChange={v => setSemanasFluxo(Number(v))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">4 semanas</SelectItem>
              <SelectItem value="8">8 semanas</SelectItem>
              <SelectItem value="13">13 semanas</SelectItem>
              <SelectItem value="26">26 semanas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Resultado gerencial (dá lucro?) ── */}
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">
            Resultado gerencial{mesFechado ? ` — ${mesFechado.rotulo}` : ''}
          </h2>
          <p className="text-xs text-muted-foreground">
            Receita faturada − despesas pagas. Visão gerencial de caixa — não é o lucro contábil (sem CMV, impostos e depreciação).
          </p>
        </div>

        {resultadoMensal.isLoading ? (
          <Skeleton className="h-24 rounded-lg" />
        ) : mesFechado ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              icon={TrendingUp}
              label={`Receita (${mesFechado.rotulo})`}
              value={formatCurrency(mesFechado.receita)}
              color="positive"
              info={KPI_INFO.receitaMes}
            />
            <StatCard
              icon={TrendingDown}
              label={`Despesa (${mesFechado.rotulo})`}
              value={formatCurrency(mesFechado.despesa)}
              color="negative"
              info={KPI_INFO.despesaMes}
            />
            <StatCard
              icon={Scale}
              label={`Resultado (${mesFechado.rotulo})`}
              value={formatCurrency(mesFechado.resultado)}
              sub={margem != null ? `margem de ${formatPercent(margem)} sobre a receita` : undefined}
              color={mesFechado.resultado >= 0 ? 'positive' : 'negative'}
              info={KPI_INFO.resultadoMes}
            />
            <StatCard
              icon={Landmark}
              label="Resultado acumulado (período)"
              value={formatCurrency(acumulado.resultado)}
              sub={`${mesesFechados.length} ${mesesFechados.length === 1 ? 'mês fechado' : 'meses fechados'} · receita ${compactBRL(acumulado.receita)} − despesa ${compactBRL(acumulado.despesa)}`}
              color={acumulado.resultado >= 0 ? 'positive' : 'negative'}
              info={KPI_INFO.resultadoAcumulado}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sem meses fechados no período selecionado — ajuste o filtro de período acima.
          </p>
        )}

        <div className="bg-card border border-border/60 rounded-lg p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold">Receita × Despesa por mês</h3>
            <KpiInfo titulo="Receita × Despesa por mês" info={KPI_INFO.graficoResultado} />
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            {resultadoPeriodo.length > 0
              ? `${resultadoPeriodo[0].rotulo} a ${resultadoPeriodo[resultadoPeriodo.length - 1].rotulo}`
              : 'Período selecionado'}
            {resultadoPeriodo.some(r => r.parcial) ? ' · mês atual parcial em tom claro' : ''}. Linha = resultado do mês.
          </p>
          {resultadoMensal.isLoading ? (
            <Skeleton className="h-72 rounded-lg" />
          ) : resultadoPeriodo.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum mês com dados no período selecionado.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={resultadoPeriodo} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tickFormatter={compactBRL} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={72} />
                <Tooltip content={<FinTooltip />} />
                <Legend formatter={legendaTexto} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Bar name="Receita" dataKey="receita" fill="hsl(var(--fin-in))" radius={[4, 4, 0, 0]} maxBarSize={22}>
                  {resultadoPeriodo.map(d => (
                    <Cell key={d.rotulo} fillOpacity={d.parcial ? 0.45 : 1} />
                  ))}
                </Bar>
                <Bar name="Despesa" dataKey="despesa" fill="hsl(var(--fin-out))" radius={[4, 4, 0, 0]} maxBarSize={22}>
                  {resultadoPeriodo.map(d => (
                    <Cell key={d.rotulo} fillOpacity={d.parcial ? 0.45 : 1} />
                  ))}
                </Bar>
                <Line
                  name="Resultado"
                  dataKey="resultado"
                  stroke="hsl(var(--foreground))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'hsl(var(--foreground))' }}
                  type="monotone"
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Fluxo de caixa projetado ── */}
      <div className="bg-card border border-border/60 rounded-lg p-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold">Fluxo de caixa projetado (próximas {semanasFluxo} semanas)</h3>
          <KpiInfo titulo="Fluxo de caixa projetado" info={KPI_INFO.graficoFluxo} />
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Títulos em aberto por semana de vencimento: entradas (a receber) × saídas (a pagar). Linha = saldo da semana.
        </p>
        {fluxoSemanal.isLoading ? (
          <Skeleton className="h-64 rounded-lg" />
        ) : (fluxoSemanal.data ?? []).length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhum vencimento em aberto nas próximas semanas.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={fluxoSemanal.data ?? []} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={compactBRL} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={72} />
              <Tooltip content={<FinTooltip />} />
              <Legend formatter={legendaTexto} />
              <ReferenceLine y={0} stroke="hsl(var(--border))" />
              <Bar name="Entradas" dataKey="entradas" fill="hsl(var(--fin-in))" radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Bar name="Saídas" dataKey="saidas" fill="hsl(var(--fin-out))" radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Line
                name="Saldo"
                dataKey="saldo"
                stroke="hsl(var(--foreground))"
                strokeWidth={2}
                dot={{ r: 3, fill: 'hsl(var(--foreground))' }}
                type="monotone"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          icon={TrendingDown}
          label="Contas a Pagar (aberto)"
          value={formatCurrency(liquidez.data?.total_a_pagar_aberto ?? 0)}
          color="negative"
          info={KPI_INFO.contasPagar}
        />
        <StatCard
          icon={TrendingUp}
          label="Contas a Receber (aberto)"
          value={formatCurrency(liquidez.data?.total_a_receber_aberto ?? 0)}
          color="positive"
          info={KPI_INFO.contasReceber}
        />
        <StatCard
          icon={Landmark}
          label="Saldo Projetado"
          value={formatCurrency(liquidez.data?.saldo_projetado ?? 0)}
          sub="a receber − a pagar (em aberto)"
          color={(liquidez.data?.saldo_projetado ?? 0) >= 0 ? 'positive' : 'negative'}
          info={KPI_INFO.saldoProjetado}
        />
        <StatCard
          icon={AlertTriangle}
          label="Inadimplência"
          value={formatPercent(inadimplencia.data?.percentual ?? 0)}
          sub={`${formatCurrency(inadimplencia.data?.valor_vencido ?? 0)} vencidos`}
          color={(inadimplencia.data?.percentual ?? 0) > 0.1 ? 'negative' : 'default'}
          info={KPI_INFO.inadimplencia}
        />
        <StatCard
          icon={Clock}
          label="PMR (Prazo Médio Recebimento)"
          value={`${(prazos.data?.pmr_dias ?? 0).toFixed(0)} dias`}
          info={KPI_INFO.pmr}
        />
        <StatCard
          icon={Clock}
          label="PMP (Prazo Médio Pagamento)"
          value={`${(prazos.data?.pmp_dias ?? 0).toFixed(0)} dias`}
          info={KPI_INFO.pmp}
        />
      </div>

      {/* ── Comparativo entre empresas ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Comparativo entre empresas</h2>
            <p className="text-xs text-muted-foreground">
              As 3 empresas lado a lado — sempre todas, independente do filtro acima.
              {(comparativo.data?.[0]?.mes_ref) ? ` Valores de mês referentes a ${comparativo.data[0].mes_ref}.` : ''}
            </p>
          </div>
          <KpiInfo titulo="Comparativo entre empresas" info={KPI_INFO.comparativo} />
        </div>

        {/* Posição financeira: a receber × a pagar por empresa */}
        <div className="bg-card border border-border/60 rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-1">Posição em aberto por empresa</h3>
          <p className="text-xs text-muted-foreground mb-4">A receber (entra) × a pagar (sai) em aberto.</p>
          {comparativo.isLoading ? (
            <Skeleton className="h-56 rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={comparativo.data ?? []} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="empresa_nome" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tickFormatter={compactBRL} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={72} />
                <Tooltip content={<FinTooltip />} />
                <Legend formatter={legendaTexto} />
                <Bar name="A receber" dataKey="a_receber_aberto" fill="hsl(var(--fin-in))" radius={[4, 4, 0, 0]} maxBarSize={44} />
                <Bar name="A pagar" dataKey="a_pagar_aberto" fill="hsl(var(--fin-out))" radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tabela lado a lado de todos os indicadores */}
        <div className="bg-card border border-border/60 rounded-lg p-4 overflow-x-auto">
          {comparativo.isLoading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-border/60">
                  <th className="text-left font-medium text-muted-foreground py-2 pr-4">Indicador</th>
                  {(comparativo.data ?? []).map(c => (
                    <th key={c.empresa_codigo} className="text-right font-semibold py-2 pl-4 whitespace-nowrap">{c.empresa_nome}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {([
                  { rot: `Receita (${comparativo.data?.[0]?.mes_ref ?? 'mês'})`, get: (c: ComparativoEmpresa) => formatCurrency(c.receita_mes), cls: () => '' },
                  { rot: `Despesa (${comparativo.data?.[0]?.mes_ref ?? 'mês'})`, get: (c: ComparativoEmpresa) => formatCurrency(c.despesa_mes), cls: () => '' },
                  { rot: `Resultado (${comparativo.data?.[0]?.mes_ref ?? 'mês'})`, get: (c: ComparativoEmpresa) => formatCurrency(c.resultado_mes), cls: (c: ComparativoEmpresa) => c.resultado_mes >= 0 ? 'text-emerald-400' : 'text-destructive', bold: true },
                  { rot: 'A receber (aberto)', get: (c: ComparativoEmpresa) => formatCurrency(c.a_receber_aberto), cls: () => '' },
                  { rot: 'A pagar (aberto)', get: (c: ComparativoEmpresa) => formatCurrency(c.a_pagar_aberto), cls: () => '' },
                  { rot: 'Saldo projetado', get: (c: ComparativoEmpresa) => formatCurrency(c.saldo_projetado), cls: (c: ComparativoEmpresa) => c.saldo_projetado >= 0 ? 'text-emerald-400' : 'text-destructive' },
                  { rot: 'Inadimplência', get: (c: ComparativoEmpresa) => formatPercent(c.inadimplencia_pct), cls: (c: ComparativoEmpresa) => c.inadimplencia_pct > 0.1 ? 'text-destructive' : '' },
                  { rot: 'PMR (recebimento)', get: (c: ComparativoEmpresa) => `${c.pmr_dias.toFixed(0)} dias`, cls: (c: ComparativoEmpresa) => c.pmr_dias > c.pmp_dias ? 'text-destructive' : '' },
                  { rot: 'PMP (pagamento)', get: (c: ComparativoEmpresa) => `${c.pmp_dias.toFixed(0)} dias`, cls: () => '' },
                ] as const).map((linha, i) => (
                  <tr key={linha.rot} className={i < 8 ? 'border-b border-border/40' : ''}>
                    <td className="text-left font-sans text-muted-foreground py-2 pr-4">{linha.rot}</td>
                    {(comparativo.data ?? []).map(c => (
                      <td key={c.empresa_codigo} className={`text-right py-2 pl-4 whitespace-nowrap ${('bold' in linha && linha.bold) ? 'font-bold' : ''} ${linha.cls(c) || 'text-foreground'}`}>
                        {linha.get(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[11px] text-muted-foreground mt-3">
            PMR em vermelho = a empresa recebe mais devagar do que paga (financia o cliente). Inadimplência em vermelho = acima de 10%.
          </p>
        </div>
      </div>

      {/* ── Aging de recebíveis ── */}
      <div className="bg-card border border-border/60 rounded-lg p-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold">Aging de Recebíveis (em aberto)</h3>
          <KpiInfo titulo="Aging de Recebíveis" info={KPI_INFO.graficoAging} />
        </div>
        <p className="text-xs text-muted-foreground mb-4">Valor em aberto por faixa de atraso</p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={aging.data ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="faixa" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={90} />
            <Tooltip content={<AgingTooltip />} />
            <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        {(aging.data ?? []).length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Nenhum título em aberto no período — sincronização com o Senior XT ainda não configurada ou sem dados.
          </p>
        )}
      </div>

      {/* ── Rankings acionáveis ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border/60 rounded-lg p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold">Top 10 devedores (vencidos)</h3>
            <KpiInfo titulo="Top 10 devedores" info={KPI_INFO.topDevedores} />
          </div>
          <p className="text-xs text-muted-foreground mb-4">Clientes com maior valor a receber vencido — a lista de cobrança.</p>
          {topDevedores.isLoading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (topDevedores.data ?? []).length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum recebível vencido no filtro atual.</p>
          ) : (
            <RankingChart data={topDevedores.data ?? []} cor="hsl(var(--destructive))" />
          )}
        </div>

        <div className="bg-card border border-border/60 rounded-lg p-4">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold">Top 10 fornecedores a pagar</h3>
            <KpiInfo titulo="Top 10 fornecedores a pagar" info={KPI_INFO.topFornecedores} />
          </div>
          <p className="text-xs text-muted-foreground mb-4">Fornecedores com maior valor a pagar em aberto — onde o caixa está comprometido.</p>
          {topFornecedores.isLoading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (topFornecedores.data ?? []).length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Nenhum título a pagar em aberto no filtro atual.</p>
          ) : (
            <RankingChart data={topFornecedores.data ?? []} cor="hsl(var(--chart-4))" />
          )}
        </div>
      </div>
    </div>
  );
}
