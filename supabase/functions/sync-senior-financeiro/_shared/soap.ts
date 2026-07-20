// Cliente do web service customizado com.ello.metrics / porta ConsultarFinanceiro,
// publicado no Senior Cloud do grupo Ello.
//
// Endpoint (confirmado pelo WSDL em 2026-07-20):
//   https://webp02.seniorcloud.com.br:30301/g5-senior-services/sapiens_Synccom_ello_metrics
//
// Estilo SOAP: RPC/literal, namespace http://services.senior.com.br.
// Operação ConsultarFinanceiro, parâmetros na ordem: user, password, encryption, parameters.
// Autenticação G5 clássica: user/password do SGU + encryption = 0 (sem token).
// A regra da porta traz as 3 empresas (codEmp 10/20/30) filtrando SitTit = 'AB',
// então `parameters` vai vazio — o filtro está no SQL do serviço.

export interface MetricsConfig {
  /** URL completa da porta, sem ?wsdl. */
  endpoint: string;
  user: string;
  password: string;
  /** 0 = sem criptografia (G5 on-premises/cloud). */
  encryption?: number;
}

/**
 * Config vem de secrets SEPARADOS (não um JSON), para evitar o problema de
 * escaping de aspas do PowerShell/npx no Windows, que corrompe valores JSON:
 *   SENIOR_ENDPOINT, SENIOR_USER, SENIOR_PASSWORD, SENIOR_ENCRYPTION (opcional).
 */
export function loadMetricsConfig(): MetricsConfig {
  const endpoint = Deno.env.get("SENIOR_ENDPOINT");
  const user = Deno.env.get("SENIOR_USER");
  const password = Deno.env.get("SENIOR_PASSWORD");
  const encryption = Number(Deno.env.get("SENIOR_ENCRYPTION") ?? "0") || 0;

  const faltando = [
    !endpoint && "SENIOR_ENDPOINT",
    !user && "SENIOR_USER",
    !password && "SENIOR_PASSWORD",
  ].filter(Boolean);
  if (faltando.length > 0) {
    throw new Error(`Secrets faltando: ${faltando.join(", ")}.`);
  }
  return { endpoint: endpoint!, user: user!, password: password!, encryption };
}

function xmlEscape(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Envelope RPC/literal para qualquer porta do com.ello.metrics
 * (ConsultarFinanceiro, ConsultarContasReceber, ConsultarFaturamento...).
 */
export function buildEnvelope(cfg: MetricsConfig, operacao: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://services.senior.com.br">
  <soapenv:Body>
    <ser:${operacao}>
      <user>${xmlEscape(cfg.user)}</user>
      <password>${xmlEscape(cfg.password)}</password>
      <encryption>${cfg.encryption ?? 0}</encryption>
      <parameters></parameters>
    </ser:${operacao}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

export async function callPorta(cfg: MetricsConfig, operacao: string): Promise<string> {
  const res = await fetch(cfg.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "",
    },
    body: buildEnvelope(cfg, operacao),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Senior SOAP HTTP ${res.status} (${operacao}): ${text.slice(0, 500)}`);
  }
  return text;
}
