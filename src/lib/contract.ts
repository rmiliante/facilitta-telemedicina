/**
 * Contrato com a prefeitura: quanto a Facilitta recebe por consulta
 * (cadastro de cada médico, doctors.contract_fee, congelado na consulta
 * em appointments.contract_fee) e como o mês é cobrado por especialidade.
 *
 * Regra combinada:
 * - A partir de outubro/2026: mínimo garantido da cota mensal (ex.: 50
 *   consultas). Se as consultas realizadas passarem da cota, cobra-se
 *   cada consulta realizada.
 * - Setembro/2026 (primeiro mês): só as consultas realizadas.
 * - Antes de setembro/2026: sem faturamento (contrato ainda não começou).
 *
 * Cada consulta realizada vale o que estava combinado com o médico que a
 * atendeu. As consultas que faltam para completar a cota valem a média
 * das realizadas no mês (ou, sem nenhuma, a média do valor atual dos
 * médicos ativos da especialidade).
 */

export const CONTRACT_START_MONTH = "2026-09";

export type BillingRule = "sem_contrato" | "sem_valor" | "realizadas" | "minimo" | "excedente";

export const BILLING_RULE_LABEL: Record<BillingRule, string> = {
  sem_contrato: "Antes do início do contrato",
  sem_valor: "Falta o valor no cadastro do médico",
  realizadas: "1º mês: consultas agendadas (presentes + ausentes)",
  minimo: "Mínimo da cota contratada",
  excedente: "Acima da cota: consultas agendadas (presentes + ausentes)",
};

const round = (v: number) => Math.round(v * 100) / 100;

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
export function billing(month: string, fees: (number | null)[], cota: number, valorReferencia: number | null, ausentes = 0) {
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
    rule = "minimo";
    faturadas = cota;
  }
  const valorMedio = media === null ? null : round(media);
  if (rule === "sem_contrato") return { rule, faturadas, valor: 0, valorMedio, semValor };

  const complemento = faturadas - realizadas; // consultas que completam a cota
  const pelaMedia = complemento + ausentes; // ausentes e cota valem a média
  if (semValor > 0 || (pelaMedia > 0 && media === null)) {
    return { rule: "sem_valor" as BillingRule, faturadas, valor: null, valorMedio, semValor };
  }
  return { rule, faturadas, valor: round(soma + pelaMedia * (media ?? 0)), valorMedio, semValor };
}
