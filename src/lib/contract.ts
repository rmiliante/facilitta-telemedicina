/**
 * Contrato com a prefeitura: quanto a Facilitta recebe por consulta em
 * cada especialidade (specialties.contract_fee) e como o mês é cobrado.
 *
 * Regra combinada:
 * - A partir de outubro/2026: mínimo garantido da cota mensal (ex.: 50
 *   consultas) × valor. Se as consultas realizadas passarem da cota,
 *   cobra-se realizadas × valor.
 * - Setembro/2026 (primeiro mês): só as consultas realizadas × valor.
 * - Antes de setembro/2026: sem faturamento (contrato ainda não começou).
 */

export const CONTRACT_START_MONTH = "2026-09";

export const CONTRACT_FEE_WARNING =
  "Especialidade salva, mas o valor por consulta NÃO foi gravado: rode supabase/migration_valor_especialidade.sql no Supabase.";

export type BillingRule = "sem_contrato" | "sem_valor" | "realizadas" | "minimo" | "excedente";

export const BILLING_RULE_LABEL: Record<BillingRule, string> = {
  sem_contrato: "Antes do início do contrato",
  sem_valor: "Valor por consulta não cadastrado",
  realizadas: "1º mês: consultas realizadas",
  minimo: "Mínimo da cota contratada",
  excedente: "Acima da cota: consultas realizadas",
};

/** Quantas consultas são cobradas no mês e por qual regra. */
export function billing(month: string, realizadas: number, cota: number, valorConsulta: number | null) {
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
  if (rule !== "sem_contrato" && valorConsulta === null) {
    return { rule: "sem_valor" as BillingRule, faturadas, valor: null };
  }
  const valor = rule === "sem_contrato" ? 0 : Math.round(faturadas * (valorConsulta ?? 0) * 100) / 100;
  return { rule, faturadas, valor };
}
