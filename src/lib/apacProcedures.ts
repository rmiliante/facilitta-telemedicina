import { getSupabaseAdmin } from "@/lib/supabase";
import { examKey } from "@/lib/customExams";
import {
  EMPTY_IMAGEM,
  IMAGEM_CONTRASTE_LABEL,
  IMAGEM_MAX_DETALHE,
  IMAGEM_MAX_HIPOTESES,
  IMAGEM_MAX_RESUMO,
  IMAGEM_REGIOES,
  IMAGEM_SAFETY_LABEL,
  IMAGEM_TIPO_LABEL,
  imagemUsaContraste,
  type ImagemContraste,
  type ImagemData,
  type ImagemTipo,
} from "@/lib/imagemForm";
import { EMPTY_ENMG, ENMG_COMORB_LABEL, ENMG_MAX_HIPOTESES, ENMG_MAX_RESUMO, ENMG_PROC_LABEL, type ApacModel, type EnmgData } from "@/lib/enmgForm";

/** Laudo para solicitação de APAC: dados extras do paciente e procedimentos usados. */

export interface ApacInput {
  cns: string;
  motherName: string;
  sex: string;
  address: string;
  cep: string;
  cid: string;
  cid2: string;
  /** "enmg" = formulário da Secretaria de Saúde (eletroneuromiografia); "livre" = laudo padrão. */
  model: ApacModel;
  enmg?: EnmgData;
  imagem?: ImagemData;
}

function str(v: unknown, max: number) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function pick(raw: unknown, allowed: Record<string, string>): string[] {
  return Array.isArray(raw) ? Array.from(new Set(raw.filter((v): v is string => typeof v === "string" && v in allowed))) : [];
}

function cleanEnmg(raw: unknown): EnmgData {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    ...EMPTY_ENMG,
    procedures: pick(r.procedures, ENMG_PROC_LABEL),
    comorbidities: pick(r.comorbidities, ENMG_COMORB_LABEL),
    hypotheses: str(r.hypotheses, ENMG_MAX_HIPOTESES),
    municipality: str(r.municipality, 80),
    phoneHome: str(r.phoneHome, 30),
    phoneMobile: str(r.phoneMobile, 30),
  };
}

function cleanImagem(raw: unknown): ImagemData {
  const r = (raw ?? {}) as Record<string, unknown>;
  const tipo: ImagemTipo = typeof r.tipo === "string" && r.tipo in IMAGEM_TIPO_LABEL ? (r.tipo as ImagemTipo) : "RM";
  const regiao = typeof r.regiao === "string" && IMAGEM_REGIOES[tipo].includes(r.regiao) ? r.regiao : "";
  const contraste: ImagemContraste =
    typeof r.contraste === "string" && r.contraste in IMAGEM_CONTRASTE_LABEL ? (r.contraste as ImagemContraste) : "";
  return {
    ...EMPTY_IMAGEM,
    tipo,
    regiao,
    contraste: imagemUsaContraste(tipo) ? contraste : "",
    detalhe: str(r.detalhe, IMAGEM_MAX_DETALHE),
    safety: pick(r.safety, IMAGEM_SAFETY_LABEL),
    hypotheses: str(r.hypotheses, IMAGEM_MAX_HIPOTESES),
    municipality: str(r.municipality, 80),
    phoneMobile: str(r.phoneMobile, 30),
  };
}

export function cleanApac(raw: unknown): ApacInput {
  const r = (raw ?? {}) as Record<string, unknown>;
  const sex = str(r.sex, 20);
  const model: ApacModel = r.model === "livre" ? "livre" : r.model === "imagem" ? "imagem" : "enmg";
  return {
    model,
    enmg: model === "enmg" ? cleanEnmg(r.enmg) : undefined,
    imagem: model === "imagem" ? cleanImagem(r.imagem) : undefined,
    cns: str(r.cns, 40).replace(/\D/g, ""),
    motherName: str(r.motherName, 200),
    sex: sex === "Feminino" || sex === "Masculino" ? sex : "",
    address: str(r.address, 300),
    cep: str(r.cep, 12),
    cid: str(r.cid, 20).toUpperCase(),
    cid2: str(r.cid2, 20).toUpperCase(),
  };
}

export function validateApac(a: ApacInput, procedure: string, justificativa: string): string | null {
  if (a.model === "imagem" && a.imagem) {
    const im = a.imagem;
    if (!im.regiao) return "Escolha a região ou o estudo do exame";
    if (im.regiao === "Outro" && !im.detalhe) return "Descreva o exame no campo de detalhe";
    if (imagemUsaContraste(im.tipo) && !im.contraste) return "Informe se o exame é com ou sem contraste";
    if (!a.sex) return "Informe o sexo do paciente";
    if (!a.address) return "Informe o endereço do paciente";
    if (!im.municipality) return "Informe o município de residência";
    if (a.cns.length !== 15) return "Informe o CNS (Cartão SUS) do paciente, com 15 números";
    if (!justificativa) return "Escreva o resumo da história clínica";
    if (justificativa.length > IMAGEM_MAX_RESUMO) return `O resumo da história clínica pode ter até ${IMAGEM_MAX_RESUMO} caracteres`;
    if (!a.cid) return "Informe o CID";
    if (!im.hypotheses) return "Informe a(s) hipótese(s) diagnóstica(s)";
    return null;
  }
  if (a.model === "enmg" && a.enmg) {
    if (a.enmg.procedures.length === 0) return "Marque o procedimento solicitado (MMSS, MMII, MSD...)";
    if (!a.sex) return "Informe o sexo do paciente";
    if (!a.address) return "Informe o endereço do paciente";
    if (!a.enmg.municipality) return "Informe o município de residência";
    if (a.cns.length !== 15) return "Informe o CNS (Cartão SUS) do paciente, com 15 números";
    if (!justificativa) return "Escreva o resumo da história clínica";
    if (justificativa.length > ENMG_MAX_RESUMO) return `O resumo da história clínica pode ter até ${ENMG_MAX_RESUMO} caracteres`;
    if (!a.cid) return "Informe o CID";
    if (!a.enmg.hypotheses) return "Informe a(s) hipótese(s) diagnóstica(s)";
    return null;
  }
  if (!procedure) return "Informe o procedimento solicitado";
  if (a.cns.length !== 15) return "Informe o CNS (Cartão SUS) do paciente, com 15 números";
  if (!a.motherName) return "Informe o nome da mãe do paciente";
  if (!a.address) return "Informe o endereço do paciente";
  if (!a.cid) return "Informe o CID-10 principal";
  if (!justificativa) return "Escreva a justificativa clínica";
  return null;
}

export async function listApacProcedures(): Promise<string[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("apac_procedures")
    .select("name")
    .order("name", { ascending: true })
    .limit(2000);
  if (error) return [];
  return (data ?? []).map((r) => r.name as string);
}

/** Guarda o procedimento digitado pra sugerir nos próximos laudos. Nunca derruba a emissão. */
export async function saveApacProcedure(name: string, doctorId: string) {
  try {
    const clean = name.trim().replace(/\s+/g, " ").slice(0, 300);
    const key = examKey(clean);
    if (clean.length < 3 || !key) return;
    await getSupabaseAdmin()
      .from("apac_procedures")
      .upsert({ name: clean, name_key: key, created_by_doctor_id: doctorId }, { onConflict: "name_key", ignoreDuplicates: true });
  } catch (err) {
    console.error("Falha ao salvar procedimento APAC:", err);
  }
}

/** Atualiza o cadastro do paciente com os dados completados no laudo. Nunca derruba a emissão. */
export async function savePatientApacData(patientId: string, a: ApacInput) {
  try {
    const upd: Record<string, string | null> = {};
    if (a.cns) upd.cns = a.cns;
    if (a.motherName) upd.mother_name = a.motherName;
    if (a.sex) upd.sex = a.sex;
    if (a.address) upd.address = a.address;
    if (a.cep) upd.cep = a.cep;
    const city = a.enmg?.municipality || a.imagem?.municipality;
    if (city) upd.city = city;
    if (Object.keys(upd).length === 0) return;
    await getSupabaseAdmin().from("patients").update(upd).eq("id", patientId);
  } catch (err) {
    console.error("Falha ao atualizar o cadastro do paciente:", err);
  }
}
