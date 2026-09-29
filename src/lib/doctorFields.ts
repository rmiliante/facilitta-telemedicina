/**
 * CPF, CRM e UF do médico — saem na receita e identificam o certificado
 * digital (VIDaaS/BirdID) na assinatura. Só inclui o que veio no corpo.
 */
export function professionalFields(body: { cpf?: unknown; crm?: unknown; crmUf?: unknown }) {
  const out: Record<string, string | null> = {};
  if (typeof body.cpf === "string") out.cpf = body.cpf.replace(/\D/g, "") || null;
  if (typeof body.crm === "string") out.crm = body.crm.replace(/\D/g, "") || null;
  if (typeof body.crmUf === "string") out.crm_uf = body.crmUf.trim().toUpperCase().slice(0, 2) || null;
  return out;
}
