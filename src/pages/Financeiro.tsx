import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency, formatPercent, formatDate } from '@/utils/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Legend, ReferenceLine, Cell, PieChart, Pie,
} from 'recharts';
import { Landmark, TrendingUp, TrendingDown, Clock, AlertTriangle, RefreshCw, Scale, Info, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MESES } from '@/utils/formatters';

interface Empresa { id: string; codigo: string; nome: string }
interface Liquidez { total_a_pagar_aberto: number; total_a_receber_aberto: number; saldo_projetado: number }
interface Prazos { pmr_dias: number; pmp_dias: number }
interface Inadimplencia { valor_vencido: number; valor_total_aberto: number; percentual: number }
interface AgingFaixa { faixa: string; valor: number; quantidade: number }

const ORDEM_FAIXAS = ['A vencer', '0-30 dias', '31-60 dias', '61-90 dias', '90+ dias'];

/** Rampa de severidade do aging: em dia (verde) → atraso crítico (vermelho). */
const COR_AGING: Record<string, string> = {
  'A vencer': 'hsl(var(--fin-in))',
  '0-30 dias': 'hsl(48 90% 50%)',
  '31-60 dias': 'hsl(32 92% 52%)',
  '61-90 dias': 'hsl(18 88% 52%)',
  '90+ dias': 'hsl(var(--fin-out))',
};

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

interface DreMes {
  ano: number; mes: number;
  receita_bruta: number; impostos: number; deducoes: number;
  receita_liquida: number; cmv: number; lucro_bruto: number;
  desp_pessoal: number; desp_operacional: number; desp_financeira: number; desp_tributaria: number;
  despesas: number; resultado_liquido: number;
  margem_bruta: number; margem_liquida: number;
}

function useDre(empresaCodigo: string | null) {
  return useQuery({
    queryKey: ['kpi-financeiro', empresaCodigo, 'dre'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_kpi_financeiro_dre', {
        empresa_codigo: empresaCodigo, meses: 36,
      });
      if (error) throw error;
      return (data as DreMes[]).map(r => ({
        ano: r.ano, mes: r.mes,
        receita_bruta: Number(r.receita_bruta) || 0,
        impostos: Number(r.impostos) || 0,
        deducoes: Number(r.deducoes) || 0,
        receita_liquida: Number(r.receita_liquida) || 0,
        cmv: Number(r.cmv) || 0,
        lucro_bruto: Number(r.lucro_bruto) || 0,
        desp_pessoal: Number(r.desp_pessoal) || 0,
        desp_operacional: Number(r.desp_operacional) || 0,
        desp_financeira: Number(r.desp_financeira) || 0,
        desp_tributaria: Number(r.desp_tributaria) || 0,
        despesas: Number(r.despesas) || 0,
        resultado_liquido: Number(r.resultado_liquido) || 0,
        margem_bruta: Number(r.margem_bruta) || 0,
        margem_liquida: Number(r.margem_liquida) || 0,
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
      const { data, error } = await supabase.rpc(fn, { empresa_codigo: empresaCodigo, limite: 10 });
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
      let acumulado = 0;
      return (data as FluxoSemana[]).map(f => {
        const d = new Date(f.semana + 'T00:00:00');
        const saldo = Number(f.saldo) || 0;
        acumulado += saldo;
        return {
          ...f,
          entradas: Number(f.entradas) || 0,
          saidas: Number(f.saidas) || 0,
          saldo,
          acumulado,
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
function RankingChart({ data, cor, onSelecionar }: {
  data: RankingItem[]; cor: string; onSelecionar?: (nome: string) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 30 + 20)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 4, right: 12 }}
        onClick={(e) => {
          const p = e?.activePayload?.[0]?.payload as RankingItem | undefined;
          if (p && onSelecionar) onSelecionar(p.nome);
        }}
      >
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
        <Bar dataKey="valor" fill={cor} radius={[0, 4, 4, 0]} maxBarSize={22} className={onSelecionar ? 'cursor-pointer' : ''} />
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
  composicaoDespesas: {
    oQueE: 'As despesas do mês divididas por categoria: pessoal, operacional, financeira e impostos sobre o lucro. Exclui compra de mercadoria (que é CMV) e itens que não são despesa (empréstimos, adiantamentos, distribuição de lucros).',
    decisao: 'Mostra onde cortar tem mais efeito. Se pessoal domina, a alavanca é produtividade/quadro; se operacional pesa, revisar contratos e fornecedores de serviço; se financeira cresce, o custo da dívida está corroendo o resultado.',
  },
  comparativoNormalizado: {
    oQueE: 'Os indicadores das 3 empresas em percentual (não em reais), para comparar eficiência independente do porte de cada uma.',
    decisao: 'Em valores absolutos a maior empresa sempre parece melhor. Em percentual dá para ver quem realmente opera melhor — e replicar a prática da mais eficiente nas outras.',
  },
  dre: {
    oQueE: 'DRE gerencial (competência, por data de emissão): Receita Bruta − impostos efetivamente pagos − deduções = Receita Líquida − CMV (compra de mercadoria) = Lucro Bruto − despesas de pessoal/operacionais/financeiras/impostos sobre o lucro = Resultado Líquido. Os impostos vêm dos títulos pagos (incluem ICMS-ST e antecipações), não do que está destacado na nota.',
    decisao: 'O retrato completo do resultado: margem bruta (eficiência de compra/venda) e margem líquida (o que sobra no fim). Margem líquida negativa por meses seguidos = o negócio está queimando capital. É o indicador definitivo de "a empresa dá lucro?".',
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

// ── Resumo executivo automático (insights em linguagem de decisão) ───────────
type TomInsight = 'positivo' | 'atencao' | 'critico' | 'info';
interface Insight { tom: TomInsight; texto: string }

const NOMES_GRUPO = ['ELLO', 'FAZ DO BRASIL', 'IMPERATRIZ'];
const ehIntercompany = (nome: string) => NOMES_GRUPO.some(g => nome.toUpperCase().includes(g));

interface DadosResumo {
  escopo: string; // "o grupo" ou "a Ello Atacadão"
  mesFechado?: { rotulo: string; receita: number; despesa: number; resultado: number };
  mesAnterior?: { resultado: number };
  inadimplencia?: { percentual: number; valor_vencido: number };
  aging90?: number;
  prazos?: { pmr: number; pmp: number };
  fluxoNegativas: { rotulo: string; saldo: number }[];
  piorEmpresa?: { nome: string; pmr: number; inadimplencia: number };
  topDevedor?: { nome: string; valor: number; quantidade: number };
}

function gerarResumoExecutivo(d: DadosResumo): Insight[] {
  const ins: Insight[] = [];

  if (d.mesFechado) {
    const m = d.mesFechado;
    const margem = m.receita > 0 ? m.resultado / m.receita : 0;
    if (m.resultado >= 0) {
      let t = `Em ${m.rotulo}, ${d.escopo} teve resultado positivo de ${formatCurrency(m.resultado)} (margem de ${formatPercent(margem)}).`;
      if (d.mesAnterior) {
        const delta = m.resultado - d.mesAnterior.resultado;
        t += delta >= 0
          ? ` Melhorou ${formatCurrency(Math.abs(delta))} frente ao mês anterior.`
          : ` Caiu ${formatCurrency(Math.abs(delta))} frente ao mês anterior.`;
      }
      ins.push({ tom: 'positivo', texto: t });
    } else {
      ins.push({
        tom: 'critico',
        texto: `Em ${m.rotulo}, ${d.escopo} teve resultado NEGATIVO de ${formatCurrency(m.resultado)} — as despesas pagas superaram a receita faturada.`,
      });
    }
  }

  if (d.inadimplencia && d.inadimplencia.percentual > 0.1) {
    let t = `${formatPercent(d.inadimplencia.percentual)} da carteira a receber está vencida (${formatCurrency(d.inadimplencia.valor_vencido)}).`;
    if (d.aging90 && d.aging90 > 0) t += ` Desses, ${formatCurrency(d.aging90)} há mais de 90 dias — candidatos a negociação, protesto ou baixa.`;
    ins.push({ tom: d.inadimplencia.percentual > 0.3 ? 'critico' : 'atencao', texto: t });
  }

  if (d.fluxoNegativas.length > 0) {
    const pior = d.fluxoNegativas.reduce((a, b) => (b.saldo < a.saldo ? b : a));
    ins.push({
      tom: 'atencao',
      texto: `Caixa projetado negativo em ${d.fluxoNegativas.length} das próximas semanas (pior: semana de ${pior.rotulo}, ${formatCurrency(pior.saldo)}). Avaliar antecipar recebíveis ou postergar pagamentos.`,
    });
  }

  if (d.prazos && d.prazos.pmr > 0 && d.prazos.pmp > 0) {
    const diff = d.prazos.pmr - d.prazos.pmp;
    if (diff > 5) {
      ins.push({
        tom: 'atencao',
        texto: `${d.escopo} recebe em ${d.prazos.pmr.toFixed(0)} dias mas paga em ${d.prazos.pmp.toFixed(0)} — financia o cliente por ${diff.toFixed(0)} dias, pressionando o caixa.`,
      });
    } else if (diff < -3) {
      ins.push({
        tom: 'positivo',
        texto: `Ciclo de caixa saudável: recebe em ${d.prazos.pmr.toFixed(0)} dias e paga em ${d.prazos.pmp.toFixed(0)} — os fornecedores financiam a operação.`,
      });
    }
  }

  if (d.piorEmpresa) {
    ins.push({
      tom: 'atencao',
      texto: `Entre as empresas, ${d.piorEmpresa.nome} é o ponto de atenção: PMR de ${d.piorEmpresa.pmr.toFixed(0)} dias e inadimplência de ${formatPercent(d.piorEmpresa.inadimplencia)}.`,
    });
  }

  if (d.topDevedor) {
    const td = d.topDevedor;
    if (ehIntercompany(td.nome)) {
      ins.push({
        tom: 'info',
        texto: `O maior "devedor" é intercompany — ${td.nome} (${formatCurrency(td.valor)}, ${td.quantidade} títulos). É conta a consolidar entre empresas do grupo, não cobrança externa.`,
      });
    } else {
      ins.push({
        tom: 'atencao',
        texto: `Maior devedor externo: ${td.nome}, com ${formatCurrency(td.valor)} vencidos em ${td.quantidade} título${td.quantidade === 1 ? '' : 's'} — priorizar na cobrança.`,
      });
    }
  }

  return ins;
}

const TOM_ESTILO: Record<TomInsight, { icon: React.ElementType; cor: string }> = {
  positivo: { icon: CheckCircle2, cor: 'text-emerald-400' },
  atencao: { icon: AlertTriangle, cor: 'text-yellow-400' },
  critico: { icon: AlertCircle, cor: 'text-destructive' },
  info: { icon: Info, cor: 'text-primary' },
};

function ResumoExecutivo({ insights, isLoading }: { insights: Insight[]; isLoading: boolean }) {
  if (isLoading) return <Skeleton className="h-28 rounded-lg" />;
  if (insights.length === 0) return null;
  return (
    <div className="bg-primary/[0.05] border border-primary/20 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Resumo executivo</h2>
        <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">gerado dos dados atuais</span>
      </div>
      <ul className="space-y-2">
        {insights.map((i, idx) => {
          const { icon: Icon, cor } = TOM_ESTILO[i.tom];
          return (
            <li key={idx} className="flex items-start gap-2.5 text-sm">
              <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cor}`} />
              <span className="text-foreground/90 leading-relaxed">{i.texto}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Waterfall da DRE: mostra visualmente como a Receita Líquida vira Resultado. */
function DreWaterfall({ d }: { d: DreMes }) {
  const lb = d.lucro_bruto;
  const res = d.resultado_liquido;
  // cada passo: base (transparente) + valor (colorido) empilhados
  const steps = [
    { name: 'Rec. Líquida', base: 0, val: d.receita_liquida, tom: 'total' as const },
    { name: '(−) CMV', base: lb, val: d.cmv, tom: 'neg' as const },
    { name: '(−) Despesas', base: res >= 0 ? res : lb - d.despesas, val: d.despesas, tom: 'neg' as const },
    { name: 'Resultado', base: res >= 0 ? 0 : res, val: Math.abs(res), tom: (res >= 0 ? 'total' : 'perda') as const },
  ];
  const cor = (tom: string) =>
    tom === 'neg' ? 'hsl(var(--fin-out))' : tom === 'perda' ? 'hsl(var(--destructive))' : 'hsl(var(--fin-in))';
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={steps} margin={{ top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis tickFormatter={compactBRL} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={72} />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted-foreground) / 0.08)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload.find(x => x.dataKey === 'val')?.payload as (typeof steps)[0];
            if (!p) return null;
            return (
              <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl">
                <p className="font-semibold text-foreground mb-1">{p.name}</p>
                <p className="font-mono font-semibold" style={{ color: cor(p.tom) }}>
                  {p.tom === 'neg' ? '− ' : ''}{formatCurrency(p.val)}
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="base" stackId="wf" fill="transparent" />
        <Bar dataKey="val" stackId="wf" radius={[3, 3, 0, 0]} maxBarSize={64}>
          {steps.map((s, i) => <Cell key={i} fill={cor(s.tom)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Cores das categorias de despesa (identidade fixa, nunca por ranking). */
const COR_DESPESA = ['hsl(217 91% 60%)', 'hsl(270 70% 62%)', 'hsl(32 92% 52%)', 'hsl(340 75% 58%)'];

/**
 * Cor por EMPRESA (identidade fixa — não muda com o ranking). Hues bem separadas
 * (azul / âmbar é o par mais seguro para daltonismo); a legenda e os rótulos de
 * valor garantem que a identidade nunca dependa só da cor.
 */
const COR_EMPRESA = ['hsl(217 91% 60%)', 'hsl(32 92% 52%)', 'hsl(270 70% 62%)'];

/** Composição das despesas do mês: onde o dinheiro é gasto. */
function DespesasDonut({ d }: { d: DreMes }) {
  const dados = [
    { nome: 'Pessoal', valor: d.desp_pessoal },
    { nome: 'Operacional', valor: d.desp_operacional },
    { nome: 'Financeira', valor: d.desp_financeira },
    { nome: 'Impostos s/ Lucro', valor: d.desp_tributaria },
  ].filter(x => x.valor > 0);
  const total = dados.reduce((s, x) => s + x.valor, 0);
  if (total === 0) return <p className="text-center text-sm text-muted-foreground py-8">Sem despesas classificadas neste mês.</p>;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <ResponsiveContainer width="100%" height={190} className="max-w-[220px]">
        <PieChart>
          <Pie data={dados} dataKey="valor" nameKey="nome" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={2}>
            {dados.map((x, i) => <Cell key={x.nome} fill={COR_DESPESA[i % COR_DESPESA.length]} />)}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { nome: string; valor: number };
              return (
                <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl">
                  <p className="font-semibold text-foreground mb-1">{p.nome}</p>
                  <p className="font-mono font-semibold text-foreground">{formatCurrency(p.valor)}</p>
                  <p className="text-muted-foreground">{formatPercent(p.valor / total)} das despesas</p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <ul className="flex-1 w-full space-y-1.5 text-sm">
        {dados.map((x, i) => (
          <li key={x.nome} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: COR_DESPESA[i % COR_DESPESA.length] }} />
            <span className="text-muted-foreground flex-1">{x.nome}</span>
            <span className="font-mono tabular-nums text-foreground">{formatCurrency(x.valor)}</span>
            <span className="font-mono tabular-nums text-xs text-muted-foreground w-12 text-right">{formatPercent(x.valor / total)}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 pt-1.5 border-t border-border/60 font-semibold">
          <span className="flex-1">Total</span>
          <span className="font-mono tabular-nums">{formatCurrency(total)}</span>
          <span className="w-12" />
        </li>
      </ul>
    </div>
  );
}

/** DRE em cascata (tabela precisa, complementa o waterfall). */
function DreCascata({ d }: { d: DreMes }) {
  const linhas: { rot: string; val: number; tipo: 'base' | 'menos' | 'subtotal' | 'resultado' }[] = [
    { rot: 'Receita Bruta', val: d.receita_bruta, tipo: 'base' },
    { rot: '(−) Impostos s/ venda (pagos)', val: -d.impostos, tipo: 'menos' },
    { rot: '(−) Deduções e devoluções', val: -d.deducoes, tipo: 'menos' },
    { rot: '(=) Receita Líquida', val: d.receita_liquida, tipo: 'subtotal' },
    { rot: '(−) CMV (custo das mercadorias)', val: -d.cmv, tipo: 'menos' },
    { rot: '(=) Lucro Bruto', val: d.lucro_bruto, tipo: 'subtotal' },
    { rot: '(−) Despesas com Pessoal', val: -d.desp_pessoal, tipo: 'menos' },
    { rot: '(−) Despesas Operacionais', val: -d.desp_operacional, tipo: 'menos' },
    { rot: '(−) Despesas Financeiras', val: -d.desp_financeira, tipo: 'menos' },
    { rot: '(−) Impostos sobre o Lucro', val: -d.desp_tributaria, tipo: 'menos' },
    { rot: '(=) Resultado Líquido', val: d.resultado_liquido, tipo: 'resultado' },
  ];
  const base = d.receita_bruta || 1;
  return (
    <table className="w-full text-sm">
      <tbody className="font-mono tabular-nums">
        {linhas.map((l) => {
          const pct = l.val / base;
          const isSub = l.tipo === 'subtotal';
          const isRes = l.tipo === 'resultado';
          return (
            <tr
              key={l.rot}
              className={`${isSub || isRes ? 'border-t border-border/60' : ''} ${isRes ? 'border-b-2 border-border' : ''}`}
            >
              <td className={`py-1.5 pr-4 font-sans ${isSub || isRes ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                {l.rot}
              </td>
              <td className={`py-1.5 text-right whitespace-nowrap ${isRes ? 'font-bold ' : ''}${
                isRes ? (l.val >= 0 ? 'text-emerald-400' : 'text-destructive') : l.tipo === 'menos' ? 'text-destructive/80' : 'text-foreground'
              }`}>
                {formatCurrency(l.val)}
              </td>
              <td className="py-1.5 pl-3 text-right text-xs text-muted-foreground w-16">
                {formatPercent(pct)}
              </td>
            </tr>
          );
        })}
        <tr>
          <td className="pt-2 font-sans text-xs text-muted-foreground">Margem bruta (sobre receita líquida)</td>
          <td className="pt-2 text-right font-semibold text-foreground" colSpan={2}>{formatPercent(d.margem_bruta)}</td>
        </tr>
        <tr>
          <td className="font-sans text-xs text-muted-foreground">Margem líquida (sobre receita líquida)</td>
          <td className={`text-right font-bold ${d.margem_liquida >= 0 ? 'text-emerald-400' : 'text-destructive'}`} colSpan={2}>
            {formatPercent(d.margem_liquida)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ── Drill-down: títulos que compõem um número do dashboard ───────────────────

interface DetalheFiltro {
  titulo: string;
  descricao?: string;
  tipo: 'pagar' | 'receber';
  empresa?: string | null;
  status?: string | null;
  vencidos?: boolean;
  faixa?: string | null;
  parceiro?: string | null;
}

interface TituloDetalhe {
  empresa: string; titulo: string; parceiro: string | null; valor: number;
  data_emissao: string | null; data_vencimento: string | null; data_pagamento: string | null;
  status: string; dias_atraso: number;
}

function useTitulosDetalhe(f: DetalheFiltro | null) {
  return useQuery({
    queryKey: ['financeiro-detalhe', f],
    enabled: !!f,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)('get_financeiro_titulos', {
        p_tipo: f!.tipo,
        p_empresa: f!.empresa ?? null,
        p_status: f!.status ?? null,
        p_vencidos: f!.vencidos ?? false,
        p_faixa: f!.faixa ?? null,
        p_parceiro: f!.parceiro ?? null,
        p_limite: 200,
      });
      if (error) throw error;
      return (data as TituloDetalhe[]).map(t => ({ ...t, valor: Number(t.valor) || 0 }));
    },
    staleTime: 1000 * 60,
  });
}

/** Modal com a lista de títulos por trás de um indicador. */
function DetalheTitulos({ filtro, onClose }: { filtro: DetalheFiltro | null; onClose: () => void }) {
  const { data, isLoading } = useTitulosDetalhe(filtro);
  const total = (data ?? []).reduce((s, t) => s + t.valor, 0);

  return (
    <Dialog open={!!filtro} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">{filtro?.titulo}</DialogTitle>
          <DialogDescription className="text-xs">
            {filtro?.descricao}
            {data && !isLoading && (
              <> · <strong className="text-foreground">{data.length}</strong> título{data.length === 1 ? '' : 's'} · total{' '}
                <strong className="text-foreground font-mono">{formatCurrency(total)}</strong>
                {data.length >= 200 && ' (mostrando os 200 maiores)'}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto -mx-1 px-1">
          {isLoading ? (
            <Skeleton className="h-64 rounded-lg" />
          ) : (data ?? []).length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">Nenhum título encontrado para este filtro.</p>
          ) : (
            <table className="w-full text-xs min-w-[680px]">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left font-medium py-2 pr-3">Título</th>
                  <th className="text-left font-medium py-2 pr-3">Cliente / Fornecedor</th>
                  <th className="text-left font-medium py-2 pr-3">Empresa</th>
                  <th className="text-right font-medium py-2 px-3">Valor</th>
                  <th className="text-center font-medium py-2 px-3">Emissão</th>
                  <th className="text-center font-medium py-2 px-3">Vencimento</th>
                  <th className="text-center font-medium py-2 pl-3">Situação</th>
                </tr>
              </thead>
              <tbody>
                {(data ?? []).map((t, i) => (
                  <tr key={`${t.titulo}-${i}`} className="border-b border-border/40 hover:bg-secondary/40">
                    <td className="py-1.5 pr-3 font-mono">{t.titulo}</td>
                    <td className="py-1.5 pr-3 max-w-[220px] truncate" title={t.parceiro ?? ''}>{t.parceiro ?? '—'}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{t.empresa}</td>
                    <td className="py-1.5 px-3 text-right font-mono tabular-nums font-semibold">{formatCurrency(t.valor)}</td>
                    <td className="py-1.5 px-3 text-center font-mono text-muted-foreground">{t.data_emissao ? formatDate(t.data_emissao) : '—'}</td>
                    <td className="py-1.5 px-3 text-center font-mono">
                      {t.data_vencimento ? formatDate(t.data_vencimento) : '—'}
                      {t.status === 'AB' && t.dias_atraso > 0 && (
                        <span className="ml-1.5 text-destructive">({t.dias_atraso}d)</span>
                      )}
                    </td>
                    <td className="py-1.5 pl-3 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        t.status === 'LQ' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-yellow-500/15 text-yellow-400'
                      }`}>
                        {t.status === 'LQ' ? 'pago' : 'aberto'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Blocos de layout: dão hierarquia e ritmo consistentes à página ───────────

/** Divisória de capítulo: título discreto em versalete + régua fina. */
function Secao({ titulo, descricao, acao, children }: {
  titulo: string; descricao?: string; acao?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3 border-b border-border/50 pb-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{titulo}</h2>
          {descricao && <p className="text-xs text-muted-foreground/80 mt-1 max-w-2xl">{descricao}</p>}
        </div>
        {acao && <div className="shrink-0">{acao}</div>}
      </div>
      {children}
    </section>
  );
}

/** Painel padrão: um card com título, ⓘ opcional e descrição. */
function Painel({ titulo, descricao, info, acao, className = '', children }: {
  titulo?: string; descricao?: string; info?: KpiInfoTexto; acao?: React.ReactNode;
  className?: string; children: React.ReactNode;
}) {
  return (
    <div className={`bg-card border border-border/50 rounded-xl p-4 sm:p-5 shadow-sm ${className}`}>
      {(titulo || acao) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            {titulo && (
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-foreground truncate">{titulo}</h3>
                {info && <KpiInfo titulo={titulo} info={info} />}
              </div>
            )}
            {descricao && <p className="text-xs text-muted-foreground mt-1 max-w-prose">{descricao}</p>}
          </div>
          {acao && <div className="shrink-0">{acao}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/**
 * Sparkline: mini-tendência dos últimos meses. SVG puro (leve — são vários por
 * tela); o último ponto é destacado, e a cor segue a direção da série.
 */
function Sparkline({ dados, className = '' }: { dados: number[]; className?: string }) {
  if (dados.length < 2) return null;
  const W = 64, H = 22, P = 2;
  const min = Math.min(...dados, 0);
  const max = Math.max(...dados, 0);
  const span = max - min || 1;
  const x = (i: number) => P + (i * (W - P * 2)) / (dados.length - 1);
  const y = (v: number) => H - P - ((v - min) / span) * (H - P * 2);
  const linha = dados.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${linha} L${x(dados.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;
  const subindo = dados[dados.length - 1] >= dados[0];
  const cor = subindo ? 'hsl(var(--fin-in))' : 'hsl(var(--fin-out))';
  const id = `sp${Math.round(dados[0] ?? 0)}-${dados.length}`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={cor} stopOpacity="0.28" />
          <stop offset="100%" stopColor={cor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={linha} fill="none" stroke={cor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(dados.length - 1)} cy={y(dados[dados.length - 1])} r="2" fill={cor} />
    </svg>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = 'default', info, spark, onDetalhe }: {
  icon: React.ElementType; label: string; value: string; sub?: string;
  color?: 'default' | 'positive' | 'negative' | 'warning';
  info?: KpiInfoTexto;
  /** Série dos últimos meses para a mini-tendência ao lado do número. */
  spark?: number[];
  /** Quando definido, o cartão fica clicável e abre a lista de títulos. */
  onDetalhe?: () => void;
}) {
  const colors = { default: 'text-foreground', positive: 'text-emerald-400', negative: 'text-destructive', warning: 'text-yellow-400' };
  return (
    <div
      onClick={onDetalhe}
      role={onDetalhe ? 'button' : undefined}
      tabIndex={onDetalhe ? 0 : undefined}
      onKeyDown={onDetalhe ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDetalhe(); } } : undefined}
      className={`bg-card border border-border/50 rounded-xl p-4 shadow-sm flex flex-col gap-2 transition-colors hover:border-border ${
        onDetalhe ? 'cursor-pointer hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground tracking-[0.1em] uppercase font-medium leading-tight">{label}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {info && <KpiInfo titulo={label} info={info} />}
          <div className="bg-secondary rounded-md p-1.5">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className={`text-[1.35rem] leading-tight font-bold tabular-nums font-mono tracking-tight ${colors[color]}`}>{value}</p>
        {spark && spark.length > 1 && <Sparkline dados={spark} className="shrink-0 mb-0.5" />}
      </div>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      {onDetalhe && (
        <p className="text-[10px] text-primary/70 uppercase tracking-wider font-medium mt-auto pt-0.5">ver títulos →</p>
      )}
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
  const [dreMesSelecionado, setDreMesSelecionado] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheFiltro | null>(null);

  const { liquidez, prazos, inadimplencia, aging } = useKpiFinanceiro(filtro);
  const resultadoMensal = useResultadoMensal(filtro);
  const dre = useDre(filtro);
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
  // DRE do período selecionado (mesmo recorte do resultado), com rótulo por mês.
  const dreDoPeriodo = (dre.data ?? [])
    .filter(d => {
      const chave = chaveMes(d.ano, d.mes);
      return chave >= rangeIni && chave <= rangeFim;
    })
    .map(d => ({ ...d, chave: `${d.ano}-${d.mes}`, rotulo: `${MESES[d.mes - 1]}/${String(d.ano).slice(2)}` }));
  const dreComDados = dreDoPeriodo.filter(d => d.receita_bruta > 0 || d.cmv > 0 || d.despesas > 0);
  const dreMes = dreComDados.find(d => d.chave === dreMesSelecionado) ?? dreComDados[dreComDados.length - 1];
  const margem = mesFechado && mesFechado.receita > 0 ? mesFechado.resultado / mesFechado.receita : null;

  // Comparativo em % (uma linha por indicador, uma barra por empresa) — o porte
  // não distorce: margem alta é bom; despesa/receita e inadimplência, quanto menor melhor.
  const dadosNormalizados = [
    { indicador: 'Margem do mês' },
    { indicador: 'Despesa / Receita' },
    { indicador: 'Inadimplência' },
  ].map(linha => {
    const row: Record<string, string | number> = { indicador: linha.indicador };
    for (const c of comparativo.data ?? []) {
      const pct =
        linha.indicador === 'Margem do mês'
          ? (c.receita_mes > 0 ? (c.resultado_mes / c.receita_mes) * 100 : 0)
          : linha.indicador === 'Despesa / Receita'
            ? (c.receita_mes > 0 ? (c.despesa_mes / c.receita_mes) * 100 : 0)
            : c.inadimplencia_pct * 100;
      row[c.empresa_codigo] = Math.round(pct * 10) / 10;
    }
    return row;
  });

  // Séries dos últimos meses fechados para as mini-tendências (sparklines)
  const ultimos = mesesFechados.slice(-12);
  const sparkReceita = ultimos.map(m => m.receita);
  const sparkDespesa = ultimos.map(m => m.despesa);
  const sparkResultado = ultimos.map(m => m.resultado);

  // Acumulado dos meses fechados do período selecionado
  const acumulado = mesesFechados.reduce(
    (acc, r) => ({ receita: acc.receita + r.receita, despesa: acc.despesa + r.despesa, resultado: acc.resultado + r.resultado }),
    { receita: 0, despesa: 0, resultado: 0 },
  );

  // ── Resumo executivo (insights derivados dos dados já carregados) ──
  const empresaSel = empresas.find(e => e.codigo === filtro);
  const mesAnteriorFechado = mesesFechados[mesesFechados.length - 2];
  const piorEmpresa = (!filtro && (comparativo.data?.length ?? 0) > 1)
    ? [...(comparativo.data ?? [])].sort((a, b) => b.inadimplencia_pct - a.inadimplencia_pct)[0]
    : undefined;
  const resumoInsights = gerarResumoExecutivo({
    escopo: empresaSel ? `a ${empresaSel.nome}` : 'o grupo',
    mesFechado: mesFechado
      ? { rotulo: mesFechado.rotulo, receita: mesFechado.receita, despesa: mesFechado.despesa, resultado: mesFechado.resultado }
      : undefined,
    mesAnterior: mesAnteriorFechado ? { resultado: mesAnteriorFechado.resultado } : undefined,
    inadimplencia: inadimplencia.data
      ? { percentual: inadimplencia.data.percentual, valor_vencido: inadimplencia.data.valor_vencido }
      : undefined,
    aging90: (aging.data ?? []).find(f => f.faixa === '90+ dias')?.valor,
    prazos: prazos.data ? { pmr: prazos.data.pmr_dias, pmp: prazos.data.pmp_dias } : undefined,
    fluxoNegativas: (fluxoSemanal.data ?? []).filter(f => f.saldo < 0).map(f => ({ rotulo: f.rotulo, saldo: f.saldo })),
    piorEmpresa: piorEmpresa && piorEmpresa.inadimplencia_pct > 0.3
      ? { nome: piorEmpresa.empresa_nome, pmr: piorEmpresa.pmr_dias, inadimplencia: piorEmpresa.inadimplencia_pct }
      : undefined,
    topDevedor: topDevedores.data?.[0],
  });

  if (isLoading) return (
    <div className="space-y-8">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );

  const escopoEmpresa = empresaSel ? empresaSel.nome : 'grupo';

  return (
    <div className="space-y-8 pb-4">

      {/* Modal de drill-down (títulos por trás de cada número) */}
      <DetalheTitulos filtro={detalhe} onClose={() => setDetalhe(null)} />

      {/* ── Header ── */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="bg-primary/10 rounded-xl p-3 border border-primary/25">
            <Landmark className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Indicadores do grupo Ello, sincronizados do Senior XT
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
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
          <span className="text-[11px] text-muted-foreground text-right">
            {sync.isPending
              ? 'Buscando dados no Senior XT — pode levar ~1 min'
              : ultimaSync.data
                ? `Atualizado em ${new Date(ultimaSync.data.executado_em).toLocaleString('pt-BR')}`
                : 'Nenhuma sincronização registrada'}
          </span>
        </div>
      </header>

      {/* ── Filtros ── */}
      <div className="bg-card/60 border border-border/50 rounded-xl p-4 flex flex-wrap gap-4 items-end">
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

      {/* ── Resumo executivo ── */}
      <ResumoExecutivo insights={resumoInsights} isLoading={resultadoMensal.isLoading || inadimplencia.isLoading || prazos.isLoading} />

      {/* ── Posição financeira (o pulso) ── */}
      <Secao
        titulo="Posição financeira"
        descricao="O que está em aberto hoje e a velocidade do ciclo de caixa."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard
            icon={TrendingDown}
            label="A pagar (aberto)"
            value={formatCurrency(liquidez.data?.total_a_pagar_aberto ?? 0)}
            color="negative"
            info={KPI_INFO.contasPagar}
            onDetalhe={() => setDetalhe({
              titulo: 'Contas a pagar em aberto',
              descricao: `Títulos não pagos — ${escopoEmpresa}`,
              tipo: 'pagar', empresa: filtro, status: 'AB',
            })}
          />
          <StatCard
            icon={TrendingUp}
            label="A receber (aberto)"
            value={formatCurrency(liquidez.data?.total_a_receber_aberto ?? 0)}
            color="positive"
            info={KPI_INFO.contasReceber}
            onDetalhe={() => setDetalhe({
              titulo: 'Contas a receber em aberto',
              descricao: `Títulos ainda não recebidos — ${escopoEmpresa}`,
              tipo: 'receber', empresa: filtro, status: 'AB',
            })}
          />
          <StatCard
            icon={Landmark}
            label="Saldo projetado"
            value={formatCurrency(liquidez.data?.saldo_projetado ?? 0)}
            sub="a receber − a pagar"
            color={(liquidez.data?.saldo_projetado ?? 0) >= 0 ? 'positive' : 'negative'}
            info={KPI_INFO.saldoProjetado}
          />
          <StatCard
            icon={AlertTriangle}
            label="Inadimplência"
            value={formatPercent(inadimplencia.data?.percentual ?? 0)}
            sub={`${compactBRL(inadimplencia.data?.valor_vencido ?? 0)} vencidos`}
            color={(inadimplencia.data?.percentual ?? 0) > 0.1 ? 'negative' : 'default'}
            info={KPI_INFO.inadimplencia}
            onDetalhe={() => setDetalhe({
              titulo: 'Recebíveis vencidos',
              descricao: `Títulos a receber já vencidos e não pagos — ${escopoEmpresa}`,
              tipo: 'receber', empresa: filtro, status: 'AB', vencidos: true,
            })}
          />
          <StatCard
            icon={Clock}
            label="PMR (recebimento)"
            value={`${(prazos.data?.pmr_dias ?? 0).toFixed(0)} dias`}
            sub="tempo até receber"
            info={KPI_INFO.pmr}
          />
          <StatCard
            icon={Clock}
            label="PMP (pagamento)"
            value={`${(prazos.data?.pmp_dias ?? 0).toFixed(0)} dias`}
            sub="tempo até pagar"
            info={KPI_INFO.pmp}
          />
        </div>
      </Secao>

      {/* ── Resultado gerencial (dá lucro?) ── */}
      <Secao
        titulo="Resultado gerencial"
        descricao="Receita faturada − despesas pagas. Visão de caixa; a DRE completa vem logo abaixo."
      >
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
              spark={sparkReceita}
            />
            <StatCard
              icon={TrendingDown}
              label={`Despesa (${mesFechado.rotulo})`}
              value={formatCurrency(mesFechado.despesa)}
              color="negative"
              info={KPI_INFO.despesaMes}
              spark={sparkDespesa}
            />
            <StatCard
              icon={Scale}
              label={`Resultado (${mesFechado.rotulo})`}
              value={formatCurrency(mesFechado.resultado)}
              sub={margem != null ? `margem de ${formatPercent(margem)} sobre a receita` : undefined}
              color={mesFechado.resultado >= 0 ? 'positive' : 'negative'}
              info={KPI_INFO.resultadoMes}
              spark={sparkResultado}
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

        <Painel
          titulo="Receita × Despesa por mês"
          info={KPI_INFO.graficoResultado}
          descricao={`${resultadoPeriodo.length > 0
            ? `${resultadoPeriodo[0].rotulo} a ${resultadoPeriodo[resultadoPeriodo.length - 1].rotulo}`
            : 'Período selecionado'}${resultadoPeriodo.some(r => r.parcial) ? ' · mês atual parcial em tom claro' : ''}. Linha = resultado do mês.`}
        >
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
        </Painel>
      </Secao>

      {/* ── DRE Gerencial (até Resultado Líquido) ── */}
      <Secao
        titulo="DRE Gerencial"
        descricao="Da receita bruta ao resultado líquido — impostos, custo das mercadorias e despesas classificadas, por competência."
        acao={<KpiInfo titulo="DRE Gerencial" info={KPI_INFO.dre} />}
      >
        <Painel titulo="Resultado Líquido por mês" descricao="Clique numa barra para abrir a DRE completa daquele mês.">
          {dre.isLoading ? (
            <Skeleton className="h-56 rounded-lg" />
          ) : dreComDados.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Sem dados de DRE no período — sincronize o Senior XT (faturamento, CMV e ctafin).</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={dreComDados}
                onClick={(e) => { const p = e?.activePayload?.[0]?.payload; if (p) setDreMesSelecionado(p.chave); }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tickFormatter={compactBRL} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={72} />
                <Tooltip content={<FinTooltip />} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.08)' }} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Bar name="Resultado Líquido" dataKey="resultado_liquido" radius={[4, 4, 0, 0]} maxBarSize={40} className="cursor-pointer">
                  {dreComDados.map(d => (
                    <Cell
                      key={d.chave}
                      fill={d.resultado_liquido >= 0 ? 'hsl(var(--fin-in))' : 'hsl(var(--fin-out))'}
                      fillOpacity={dreMes && d.chave === dreMes.chave ? 1 : 0.55}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Painel>

        {/* Cascata + composição do mês selecionado, lado a lado */}
        {dreMes && dreMes.receita_bruta > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Painel
              titulo={`Cascata — ${dreMes.rotulo}`}
              acao={
                <Select value={dreMes.chave} onValueChange={setDreMesSelecionado}>
                  <SelectTrigger className="w-[130px] h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[...dreComDados].reverse().map(d => (
                      <SelectItem key={d.chave} value={d.chave}>{d.rotulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
            >
              <DreWaterfall d={dreMes} />
              <div className="mt-4 pt-4 border-t border-border/40">
                <DreCascata d={dreMes} />
              </div>
            </Painel>

            {dreMes.despesas > 0 && (
              <Painel
                titulo={`Composição das despesas — ${dreMes.rotulo}`}
                info={KPI_INFO.composicaoDespesas}
                descricao="Onde o dinheiro é gasto, por categoria."
              >
                <DespesasDonut d={dreMes} />
              </Painel>
            )}
          </div>
        )}
      </Secao>

      {/* ── Fluxo de caixa projetado ── */}
      <Secao titulo="Caixa" descricao="Projeção das próximas semanas com base nos títulos em aberto.">
        <Painel
          titulo={`Fluxo de caixa projetado — próximas ${semanasFluxo} semanas`}
          info={KPI_INFO.graficoFluxo}
          descricao="Entradas (a receber) × saídas (a pagar) por semana de vencimento. A linha é o saldo acumulado — quando cruza o zero, é a semana em que o caixa aperta."
        >
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
                name="Saldo acumulado"
                dataKey="acumulado"
                stroke="hsl(var(--foreground))"
                strokeWidth={2.5}
                dot={{ r: 3, fill: 'hsl(var(--foreground))' }}
                type="monotone"
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
        </Painel>
      </Secao>

      {/* ── Cobrança: aging + rankings ── */}
      <Secao
        titulo="Cobrança e fornecedores"
        descricao="Qualidade da carteira a receber e onde o caixa está comprometido."
      >
        <Painel
          titulo="Aging de recebíveis (em aberto)"
          info={KPI_INFO.graficoAging}
          descricao="Valor em aberto por faixa de atraso — a cor indica a severidade. Clique numa barra para ver os títulos daquela faixa."
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={aging.data ?? []}
              onClick={(e) => {
                const p = e?.activePayload?.[0]?.payload as AgingFaixa | undefined;
                if (p) setDetalhe({
                  titulo: `Recebíveis — ${p.faixa}`,
                  descricao: `Títulos a receber em aberto nesta faixa — ${escopoEmpresa}`,
                  tipo: 'receber', empresa: filtro, status: 'AB', faixa: p.faixa,
                });
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="faixa" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={compactBRL} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={72} />
              <Tooltip content={<AgingTooltip />} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.08)' }} />
              <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={80} className="cursor-pointer">
                {(aging.data ?? []).map(f => (
                  <Cell key={f.faixa} fill={COR_AGING[f.faixa] ?? 'hsl(var(--muted-foreground))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {(aging.data ?? []).length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              Nenhum título em aberto — sincronize com o Senior XT.
            </p>
          )}
        </Painel>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Painel
            titulo="Top 10 devedores (vencidos)"
            info={KPI_INFO.topDevedores}
            descricao="Clientes com maior valor a receber vencido — a lista de cobrança. Clique num cliente para ver os títulos dele."
          >
            {topDevedores.isLoading ? (
              <Skeleton className="h-64 rounded-lg" />
            ) : (topDevedores.data ?? []).length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum recebível vencido no filtro atual.</p>
            ) : (
              <RankingChart
                data={topDevedores.data ?? []}
                cor="hsl(var(--fin-out))"
                onSelecionar={(nome) => setDetalhe({
                  titulo: nome,
                  descricao: 'Títulos a receber vencidos deste cliente',
                  tipo: 'receber', empresa: filtro, status: 'AB', vencidos: true, parceiro: nome,
                })}
              />
            )}
          </Painel>

          <Painel
            titulo="Top 10 fornecedores a pagar"
            info={KPI_INFO.topFornecedores}
            descricao="Onde o caixa está comprometido — clique num fornecedor para ver os títulos dele."
          >
            {topFornecedores.isLoading ? (
              <Skeleton className="h-64 rounded-lg" />
            ) : (topFornecedores.data ?? []).length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum título a pagar em aberto no filtro atual.</p>
            ) : (
              <RankingChart
                data={topFornecedores.data ?? []}
                cor="hsl(217 91% 60%)"
                onSelecionar={(nome) => setDetalhe({
                  titulo: nome,
                  descricao: 'Títulos a pagar em aberto deste fornecedor',
                  tipo: 'pagar', empresa: filtro, status: 'AB', parceiro: nome,
                })}
              />
            )}
          </Painel>
        </div>
      </Secao>

      {/* ── Comparativo entre empresas ── */}
      <Secao
        titulo="Comparativo entre empresas"
        descricao={`As 3 empresas lado a lado — sempre todas, independente do filtro de empresa.${
          comparativo.data?.[0]?.mes_ref ? ` Valores de mês referentes a ${comparativo.data[0].mes_ref}.` : ''
        }`}
        acao={<KpiInfo titulo="Comparativo entre empresas" info={KPI_INFO.comparativo} />}
      >
        <Painel titulo="Posição em aberto por empresa" descricao="A receber (entra) × a pagar (sai) em aberto.">
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
        </Painel>

        {/* Eficiência normalizada (%) — compara independente do porte */}
        <Painel
          titulo="Eficiência comparada (%)"
          info={KPI_INFO.comparativoNormalizado}
          descricao="Indicadores em percentual, não em reais — assim o porte da empresa não distorce a comparação."
        >
          {comparativo.isLoading ? (
            <Skeleton className="h-56 rounded-lg" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dadosNormalizados} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="indicador" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={48} />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted-foreground) / 0.08)' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl space-y-1">
                        <p className="font-semibold text-foreground">{label}</p>
                        {payload.map(p => (
                          <p key={p.name} className="flex items-center gap-2 text-foreground">
                            <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
                            {p.name}: <span className="font-mono font-semibold">{Number(p.value).toFixed(1)}%</span>
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend formatter={legendaTexto} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                {(comparativo.data ?? []).map((c, i) => (
                  <Bar
                    key={c.empresa_codigo}
                    name={c.empresa_nome}
                    dataKey={c.empresa_codigo}
                    fill={COR_EMPRESA[i % COR_EMPRESA.length]}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={34}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="text-[11px] text-muted-foreground mt-2">
            Margem: maior é melhor. Despesa/Receita e Inadimplência: menor é melhor.
          </p>
        </Painel>

        {/* Tabela lado a lado de todos os indicadores */}
        <Painel titulo="Todos os indicadores" className="overflow-x-auto">
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
        </Painel>
      </Secao>
    </div>
  );
}
