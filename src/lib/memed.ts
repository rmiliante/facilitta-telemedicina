// Integração com a prescrição digital Memed (módulo embutido).
// Docs: https://doc.memed.com.br/docs/primeiros-passos/
//
// Por padrão usa o par de chaves PÚBLICO de homologação (teste) que a
// própria Memed documenta — nesse ambiente as receitas geradas NÃO
// valem legalmente, é só pra validar o fluxo. Quando a Facilitta virar
// parceira aprovada (cadastro em memed.com.br/parceiro-software), basta
// definir MEMED_API_KEY/MEMED_SECRET_KEY/MEMED_API_URL/MEMED_SCRIPT_URL
// de produção nas variáveis de ambiente que o código passa a usá-las
// automaticamente, sem mudar nada aqui.
const HOMOLOGACAO_API_URL = "https://integrations.api.memed.com.br/v1";
const HOMOLOGACAO_SCRIPT_URL =
  "https://integrations.memed.com.br/modulos/plataforma.sinapse-prescricao/build/sinapse-prescricao.min.js";
const HOMOLOGACAO_API_KEY = "iJGiB4kjDGOLeDFPWMG3no9VnN7Abpqe3w1jEFm6olkhkZD6oSfSmYCm";
const HOMOLOGACAO_SECRET_KEY = "Xe8M5GvBGCr4FStKfxXKisRo3SfYKI7KrTMkJpCAstzu2yXVN4av5nmL";

function memedApiUrl() {
  return process.env.MEMED_API_URL || HOMOLOGACAO_API_URL;
}
function memedScriptUrl() {
  return process.env.MEMED_SCRIPT_URL || HOMOLOGACAO_SCRIPT_URL;
}
function memedApiKey() {
  return process.env.MEMED_API_KEY || HOMOLOGACAO_API_KEY;
}
function memedSecretKey() {
  return process.env.MEMED_SECRET_KEY || HOMOLOGACAO_SECRET_KEY;
}

/** true enquanto estiver usando as chaves públicas de homologação (não configuradas via env). */
export function isMemedHomologacao() {
  return !process.env.MEMED_API_KEY;
}

export interface MemedDoctorInput {
  externalId: string; // usamos o id do médico no nosso banco
  nome: string; // nome completo — é dividido em nome/sobrenome internamente
  cpf: string; // só dígitos
  crm: string; // só dígitos
  uf: string; // sigla, ex: SP
  email?: string | null;
  telefone?: string | null;
  dataNascimento: string; // dd/mm/aaaa
}

function keysQuery() {
  return `api-key=${encodeURIComponent(memedApiKey())}&secret-key=${encodeURIComponent(memedSecretKey())}`;
}

function splitName(fullName: string): { nome: string; sobrenome: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { nome: parts[0], sobrenome: parts[0] };
  return { nome: parts[0], sobrenome: parts.slice(1).join(" ") };
}

/**
 * Busca o token de acesso atual do prescritor na Memed (o token muda,
 * então sempre buscamos o mais recente antes de carregar o módulo).
 * Retorna null se o prescritor ainda não tiver sido cadastrado lá.
 */
export async function getMemedDoctorToken(externalId: string): Promise<string | null> {
  const res = await fetch(`${memedApiUrl()}/sinapse-prescricao/usuarios/${externalId}?${keysQuery()}`, {
    headers: { Accept: "application/vnd.api+json" },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.data?.attributes?.token ?? null;
}

/**
 * Cadastra (ou atualiza, se já existir) o médico como prescritor na
 * Memed, usando o id dele no nosso banco como external_id. Retorna o
 * token de acesso do prescritor.
 */
export async function upsertMemedDoctor(input: MemedDoctorInput): Promise<{ token: string }> {
  const { nome, sobrenome } = splitName(input.nome);
  const payload = {
    data: {
      type: "usuarios",
      attributes: {
        external_id: input.externalId,
        nome,
        sobrenome,
        cpf: input.cpf.replace(/\D/g, ""),
        board: {
          board_code: "CRM",
          board_number: input.crm.replace(/\D/g, ""),
          board_state: input.uf.toUpperCase(),
        },
        email: input.email || undefined,
        telefone: input.telefone ? input.telefone.replace(/\D/g, "") : undefined,
        data_nascimento: input.dataNascimento,
      },
    },
  };

  const res = await fetch(`${memedApiUrl()}/sinapse-prescricao/usuarios?${keysQuery()}`, {
    method: "POST",
    headers: { Accept: "application/vnd.api+json", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (res.ok) {
    return { token: data?.data?.attributes?.token };
  }

  // "Já cadastrado" não é erro de verdade pra gente — só significa que
  // esse médico já tinha sido vinculado antes; nesse caso, tenta
  // atualizar os dados e buscar o token atual.
  const alreadyExists =
    typeof data?.errors?.[0]?.detail === "string" &&
    data.errors[0].detail.toLowerCase().includes("já cadastrado");

  if (alreadyExists) {
    await fetch(`${memedApiUrl()}/sinapse-prescricao/usuarios/${input.externalId}?${keysQuery()}`, {
      method: "PATCH",
      headers: { Accept: "application/vnd.api+json", "Content-Type": "application/json" },
      body: JSON.stringify({
        data: {
          type: "usuarios",
          attributes: payload.data.attributes,
        },
      }),
    });
    const token = await getMemedDoctorToken(input.externalId);
    if (token) return { token };
  }

  console.error("Erro ao cadastrar prescritor na Memed:", JSON.stringify(data));
  throw new Error(
    data?.errors?.[0]?.detail || "Falha ao vincular médico na Memed. Confira os dados e tente novamente."
  );
}

export function getMemedScriptUrl() {
  return memedScriptUrl();
}
