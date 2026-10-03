/**
 * CPF, CRM e UF do médico — saem na receita e identificam o certificado
 * digital (VIDaaS/BirdID) na assinatura. Só inclui o que veio no corpo.
 */
export function professionalFields(body: { cpf?: unknown; crm?: unknown; crmUf?: unknown; rqe?: unknown; enderecoProfissional?: unknown }) {
  const out: Record<string, string | null> = {};
  if (typeof body.cpf === "string") out.cpf = body.cpf.replace(/\D/g, "") || null;
  if (typeof body.crm === "string") out.crm = body.crm.replace(/\D/g, "") || null;
  if (typeof body.crmUf === "string") out.crm_uf = body.crmUf.trim().toUpperCase().slice(0, 2) || null;
  if (typeof body.rqe === "string") out.rqe = body.rqe.replace(/\D/g, "") || null;
  if (typeof body.enderecoProfissional === "string")
    out.endereco_profissional = body.enderecoProfissional.trim().replace(/\s+/g, " ").slice(0, 200) || null;
  return out;
}

/** Coluna ainda não existe no banco (migração pendente). */
export function isMissingColumn(error: { code?: string; message?: string } | null, column: string) {
  if (!error) return false;
  return (error.code === "42703" || error.code === "PGRST204") && (error.message ?? "").includes(column);
}

export const RQE_MIGRATION_WARNING =
  "Dados salvos, mas o RQE, o endereço profissional ou o valor por consulta não foram gravados: falta rodar a atualização do banco (migration_rqe.sql e migration_valor_consulta.sql).";

/** Colunas novas que podem ainda não existir antes da migração. */
export const OPTIONAL_DOCTOR_COLUMNS = ["rqe", "endereco_profissional", "consult_fee"] as const;

/**
 * Valor por consulta digitado no admin ("70", "70,00", "R$ 1.250,50").
 * Vazio = sem valor (null). Devolve undefined se o texto for inválido.
 */
export function parseConsultFee(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 && value < 1e6 ? Math.round(value * 100) / 100 : undefined;
  if (typeof value !== "string") return undefined;
  let text = value.replace(/R\$|\s/gi, "");
  if (!text) return null;
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return undefined;
  const fee = Number(text);
  return fee < 1e6 ? Math.round(fee * 100) / 100 : undefined;
}

export function missingOptionalColumn(error: { code?: string; message?: string } | null) {
  return OPTIONAL_DOCTOR_COLUMNS.some((c) => isMissingColumn(error, c));
}

/**
 * Tira do registro só a coluna nova que o banco ainda não tem (a que o
 * erro aponta). Devolve se ela tinha valor preenchido, ou null se o erro
 * não for de coluna opcional. Chame em laço até não sobrar erro.
 */
export function stripMissingColumn(
  row: Record<string, unknown>,
  error: { code?: string; message?: string } | null
): { hadValue: boolean } | null {
  const column = OPTIONAL_DOCTOR_COLUMNS.find((c) => isMissingColumn(error, c));
  if (!column) return null;
  const hadValue = row[column] !== null && row[column] !== undefined && row[column] !== "";
  delete row[column];
  return { hadValue };
}
