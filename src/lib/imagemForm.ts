/** Solicitação de ressonância, tomografia e cintilografia (modelo da Secretaria Municipal de Saúde, estilo igual ao da ENMG). */

export type ImagemTipo = "RM" | "TC" | "CINTILO";
export type ImagemContraste = "" | "sem" | "com" | "sem_com";

export interface ImagemData {
  tipo: ImagemTipo;
  regiao: string;
  contraste: ImagemContraste;
  detalhe: string;
  safety: string[];
  hypotheses: string;
  municipality: string;
  phoneMobile: string;
}

export const EMPTY_IMAGEM: ImagemData = {
  tipo: "RM",
  regiao: "",
  contraste: "",
  detalhe: "",
  safety: [],
  hypotheses: "",
  municipality: "",
  phoneMobile: "",
};

export const IMAGEM_TIPO_LABEL: Record<ImagemTipo, string> = {
  RM: "Ressonância magnética",
  TC: "Tomografia computadorizada",
  CINTILO: "Cintilografia",
};

export const IMAGEM_TIPOS: ImagemTipo[] = ["RM", "TC", "CINTILO"];

export const IMAGEM_REGIOES: Record<ImagemTipo, string[]> = {
  RM: [
    "Crânio / encéfalo",
    "Sela túrcica / hipófise",
    "Face / seios da face",
    "Órbitas",
    "Pescoço",
    "Coluna cervical",
    "Coluna torácica",
    "Coluna lombossacra",
    "Plexo braquial",
    "Ombro",
    "Cotovelo",
    "Punho / mão",
    "Quadril / bacia",
    "Joelho",
    "Tornozelo / pé",
    "Tórax",
    "Abdome superior",
    "Pelve",
    "Mamas",
    "Angiorressonância",
    "Outro",
  ],
  TC: [
    "Crânio",
    "Face / seios da face",
    "Pescoço",
    "Tórax",
    "Abdome superior",
    "Abdome total",
    "Pelve",
    "Coluna cervical",
    "Coluna torácica",
    "Coluna lombar",
    "Articulações / ossos",
    "Angiotomografia",
    "Outro",
  ],
  CINTILO: [
    "Miocárdica (perfusão)",
    "Óssea (corpo inteiro)",
    "Tireoide",
    "Paratireoide",
    "Renal",
    "Pulmonar (ventilação / perfusão)",
    "Cerebral (SPECT)",
    "Hepatobiliar",
    "Esvaziamento gástrico",
    "Outro",
  ],
};

export const IMAGEM_CONTRASTE_LABEL: Record<Exclude<ImagemContraste, "">, string> = {
  sem: "Sem contraste",
  com: "Com contraste",
  sem_com: "Sem e com contraste",
};

export const IMAGEM_SAFETY_LABEL: Record<string, string> = {
  MARCAPASSO: "Marcapasso / implante metálico",
  CLAUSTRO: "Claustrofobia",
  GESTANTE: "Gestante",
  ALERGIA: "Alergia a contraste",
  IRC: "Insuficiência renal",
  SEDACAO: "Necessita sedação",
};

export const IMAGEM_SAFETY_ROWS: string[][] = [
  ["MARCAPASSO", "CLAUSTRO", "GESTANTE"],
  ["ALERGIA", "IRC", "SEDACAO"],
];

/** Limites de texto (o resumo e a hipótese têm poucas linhas no PDF). */
export const IMAGEM_MAX_RESUMO = 500;
export const IMAGEM_MAX_HIPOTESES = 300;
export const IMAGEM_MAX_DETALHE = 150;

export function imagemUsaContraste(tipo: ImagemTipo): boolean {
  return tipo !== "CINTILO";
}

/** Nome do exame (vai pro documento e pro histórico do paciente). */
export function imagemProcedureName(d: ImagemData): string {
  const regiao = d.regiao === "Outro" ? d.detalhe.trim() || "Outro" : d.regiao;
  if (!regiao) return "";
  const c = d.contraste && imagemUsaContraste(d.tipo) ? ` (${IMAGEM_CONTRASTE_LABEL[d.contraste].toLowerCase()})` : "";
  return `${IMAGEM_TIPO_LABEL[d.tipo]} - ${regiao}${c}`;
}
