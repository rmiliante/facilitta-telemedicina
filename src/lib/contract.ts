/**
 * Contrato com a prefeitura: quanto a Facilitta recebe por consulta
 * (cadastro de cada médico, doctors.contract_fee, congelado na consulta
 * em appointments.contract_fee) e como o mês é cobrado por especialidade.
 *
 * Regra combinada:
 * - A partir de outubro/2026: mínimo garantido da cota mensal (ex.: 50
 *   consultas). Se as consultas realizadas passarem da cota, cobra-se
 *   cada consulta realizada.
 * - Especialidade que começou no meio do mês (sem consultas antes dele): a
 *   cota mínima é proporcional aos dias de atendimento, arredondada para
 *   baixo (ex.: 50 × 11/31 dias = 17 consultas).
 * - Setembro/2026 (primeiro mês): só as consultas realizadas.
 * - Antes de setembro/2026: sem faturamento (contrato ainda não começou).
 *
 * Cada consulta realizada vale o que estava combinado com o médico que a
 * atendeu. As consultas que faltam para completar a cota valem a média
 * das realizadas no mês (ou, sem nenhuma, a média do valor atual dos
 * médicos ativos da especialidade).
 */

export const CONTRACT_START_MONTH = "2026-09";

export type BillingRule = "sem_contrato" | "sem_valor" | "realizadas" | "minimo" | "minimo_proporcional" | "excedente";

export const BILLING_RULE_LABEL: Record<BillingRule, string> = {
  sem_contrato: "Antes do início do contrato",
  sem_valor: "Falta o valor no cadastro do médico",
  realizadas: "1º mês: consultas agendadas (presentes + ausentes)",
  minimo: "Mínimo da cota contratada",
  minimo_proporcional: "Mínimo proporcional da cota (início no meio do mês)",
  excedente: "Acima da cota: consultas agendadas (presentes + ausentes)",
};

const round = (v: number) => Math.round(v * 100) / 100;

/** Cota do mês, proporcional quando a especialidade começou no meio dele. */
export function proportionalQuota(month: string, cota: number, inicio: string | null) {
  const [y, m] = month.split("-").map(Number);
  const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (!inicio || !inicio.startsWith(month) || inicio <= `${month}-01`) return { cota, proporcional: false, dias: diasMes, diasMes };
  const dias = diasMes - Number(inicio.slice(8, 10)) + 1;
  return { cota: Math.floor((cota * dias) / diasMes), proporcional: true, dias, diasMes };
}

/**
 * Faturamento de uma especialidade no mês. O agendamento gera a cobrança:
 * contam presentes (consulta realizada) e ausentes (agendados que não
 * aconteceram), pois a prefeitura paga pelo agendado no período.
 * @param fees valor de cada consulta realizada (null = sem valor gravado)
 * @param ausentes agendados no período que não foram realizados (faltas e
 *   agendamentos vencidos); entram na cobrança pela média dos presentes
 * @param valorReferencia valor atual dos médicos da especialidade, usado
 *   para completar a cota quando não houve consulta realizada com valor
 */
export function billing(month: string, fees: (number | null)[], cotaMensal: number, valorReferencia: number | null, ausentes = 0, inicio: string | null = null) {
  const q = month > CONTRACT_START_MONTH ? proportionalQuota(month, cotaMensal, inicio) : { cota: cotaMensal, proporcional: false, dias: 0, diasMes: 0 };
  const cota = q.cota;
  const realizadas = fees.length + ausentes;
  const semValor = fees.filter((f) => f === null).length;
  const comValor = fees.filter((f): f is number => f !== null);
  const soma = comValor.reduce((a, b) => a + b, 0);
  const media = comValor.length ? soma / comValor.length : valorReferencia;

  let rule: BillingRule;
  let faturadas: number;
  if (month < CONTRACT_START_MONTH) {
    rule = "sem_contrato";
    faturadas = 0;
  } else if (month === CONTRACT_START_MONTH) {
    rule = "realizadas";
    faturadas = realizadas;
  } else if (realizadas > cota) {
    rule = "excedente";
    faturadas = realizadas;
  } else {
    rule = q.proporcional ? "minimo_proporcional" : "minimo";
    faturadas = cota;
  }
  const valorMedio = media === null ? null : round(media);
  if (rule === "sem_contrato") return { rule, faturadas, valor: 0, valorMedio, semValor, cotaFaturavel: cota, proporcional: q.proporcional, dias: q.dias, diasMes: q.diasMes };

  const complemento = faturadas - realizadas; // consultas que completam a cota
  const pelaMedia = complemento + ausentes; // ausentes e cota valem a média
  if (semValor > 0 || (pelaMedia > 0 && media === null)) {
    return { rule: "sem_valor" as BillingRule, faturadas, valor: null, valorMedio, semValor, cotaFaturavel: cota, proporcional: q.proporcional, dias: q.dias, diasMes: q.diasMes };
  }
  return { rule, faturadas, valor: round(soma + pelaMedia * (media ?? 0)), valorMedio, semValor, cotaFaturavel: cota, proporcional: q.proporcional, dias: q.dias, diasMes: q.diasMes };
}
