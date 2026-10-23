/** Laudo para Solicitação/Autorização de Procedimento Ambulatorial (modelo do Ministério da Saúde, SIA/SUS). */

export interface OficialData {
  /** Código SIGTAP do procedimento, só números (10 dígitos). */
  procCode: string;
  prontuario: string;
  racaCor: string;
  responsavel: string;
  telResponsavel: string;
  telefone: string;
  municipality: string;
  ibge: string;
  uf: string;
  cid3: string;
  /** CNS ou CPF do profissional solicitante. */
  solicitanteDoc: string;
}

export const EMPTY_OFICIAL: OficialData = {
  procCode: "",
  prontuario: "",
  racaCor: "",
  responsavel: "",
  telResponsavel: "",
  telefone: "",
  municipality: "",
  ibge: "",
  uf: "",
  cid3: "",
  solicitanteDoc: "",
};

export const OFICIAL_RACAS = ["Branca", "Preta", "Parda", "Amarela", "Indígena", "Sem informação"];

export const OFICIAL_MAX_JUSTIFICATIVA = 900;

/** 0301010072 -> 03.01.01.007-2 */
export function formatSigtap(code: string): string {
  const d = code.replace(/\D/g, "");
  return d.length === 10 ? d.replace(/(\d{2})(\d{2})(\d{2})(\d{3})(\d)/, "$1.$2.$3.$4-$5") : code;
}
