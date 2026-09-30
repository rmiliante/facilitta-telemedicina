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
  "Dados salvos, mas o RQE e o endereço profissional não foram gravados: falta rodar a atualização do banco (migration_rqe.sql).";

/** Colunas novas que podem ainda não existir antes da migração. */
export const OPTIONAL_DOCTOR_COLUMNS = ["rqe", "endereco_profissional"] as const;

export function missingOptionalColumn(error: { code?: string; message?: string } | null) {
  return OPTIONAL_DOCTOR_COLUMNS.some((c) => isMissingColumn(error, c));
}

/** Tira as colunas novas do registro; diz se alguma tinha valor preenchido. */
export function stripOptionalColumns(row: Record<string, unknown>) {
  let hadValue = false;
  for (const c of OPTIONAL_DOCTOR_COLUMNS) {
    if (row[c]) hadValue = true;
    delete row[c];
  }
  return hadValue;
}
