/** Formulário de solicitação de eletroneuromiografia (modelo da Secretaria Municipal de Saúde). */

export type ApacModel = "enmg" | "imagem" | "livre";

export interface EnmgData {
  procedures: string[];
  comorbidities: string[];
  hypotheses: string;
  municipality: string;
  phoneHome: string;
  phoneMobile: string;
}

export const EMPTY_ENMG: EnmgData = {
  procedures: [],
  comorbidities: [],
  hypotheses: "",
  municipality: "",
  phoneHome: "",
  phoneMobile: "",
};

export const ENMG_PROC_LABEL: Record<string, string> = {
  MMSS: "MMSS",
  MMII: "MMII",
  MSD: "MSD",
  MSE: "MSE",
  MID: "MID",
  MIE: "MIE",
  HEMIFACE: "HEMIFACE",
  LINGUA: "GENIOGLOSSO OU LINGUA",
};

/** Ordem das caixinhas, linha a linha, como no papel. */
export const ENMG_PROC_ROWS: string[][] = [
  ["MMSS", "MSD", "MID", "HEMIFACE"],
  ["MMII", "MSE", "MIE", "LINGUA"],
];

export const ENMG_COMORB_LABEL: Record<string, string> = {
  AUTOIMUNE: "AUTO-IMUNE",
  HAS: "HAS",
  DM: "DM",
  TRAUMA: "TRAUMA NERVO PERIFÉRICO",
  IRC: "IRC",
  TCE: "TCE",
  TRM: "TRM",
  NEOPLASIA: "NEOPLASIA",
  HANSEN: "DOENÇA DE HANSEN",
};

export const ENMG_COMORB_ROWS: string[][] = [
  ["AUTOIMUNE", "HAS", "DM", "TRAUMA"],
  ["IRC", "TCE", "TRM", "NEOPLASIA", "HANSEN"],
];

/** Limites de texto (o formulário impresso tem 3 linhas pra cada campo livre). */
export const ENMG_MAX_RESUMO = 300;
export const ENMG_MAX_HIPOTESES = 300;

export function enmgProcedureName(procedures: string[]): string {
  const labels = procedures.map((p) => ENMG_PROC_LABEL[p]).filter(Boolean);
  return labels.length ? `Eletroneuromiografia (${labels.join(", ")})` : "";
}
