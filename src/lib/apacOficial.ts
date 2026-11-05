/** Laudo para Solicitação/Autorização de Procedimento Ambulatorial (modelo do Ministério da Saúde, SIA/SUS). */

export interface OficialSecundario {
  /** Código SIGTAP, só números (10 dígitos). */
  code: string;
  name: string;
  qty: string;
}

export interface OficialData {
  /** Código SIGTAP do procedimento, só números (10 dígitos). */
  procCode: string;
  prontuario: string;
  racaCor: string;
  etnia: string;
  responsavel: string;
  telResponsavel: string;
  telefone: string;
  municipality: string;
  ibge: string;
  uf: string;
  /** Campo 36: descrição curta do diagnóstico. */
  diagnostico: string;
  cid3: string;
  /** CNS ou CPF do profissional solicitante (vazio = usa o CPF do cadastro do médico). */
  solicitanteDoc: string;
  /** Procedimentos secundários (campos 21 a 35, até 5). */
  secundarios: OficialSecundario[];
}

/** Município do estabelecimento (já impresso no formulário do Polo Integrado de Saúde de Jacobina). */
export const OFICIAL_MUNICIPIO_PADRAO = { municipality: "JACOBINA", ibge: "2917701", uf: "BA", cep: "44700000" };

export const EMPTY_OFICIAL: OficialData = {
  procCode: "",
  prontuario: "",
  racaCor: "",
  etnia: "",
  responsavel: "",
  telResponsavel: "",
  telefone: "",
  municipality: OFICIAL_MUNICIPIO_PADRAO.municipality,
  ibge: OFICIAL_MUNICIPIO_PADRAO.ibge,
  uf: OFICIAL_MUNICIPIO_PADRAO.uf,
  diagnostico: "",
  cid3: "",
  solicitanteDoc: "",
  secundarios: [],
};

export const OFICIAL_RACAS = ["Branca", "Preta", "Parda", "Amarela", "Indígena", "Sem informação"];

export const OFICIAL_MAX_JUSTIFICATIVA = 900;
export const OFICIAL_MAX_SECUNDARIOS = 5;

/** 0301010072 -> 03.01.01.007-2 */
export function formatSigtap(code: string): string {
  const d = code.replace(/\D/g, "");
  return d.length === 10 ? d.replace(/(\d{2})(\d{2})(\d{2})(\d{3})(\d)/, "$1.$2.$3.$4-$5") : code;
}

export interface OficialProcedure {
  code: string;
  name: string;
  group: "Tomografia" | "Ressonância magnética" | "Medicina nuclear";
  /** Contraste que acompanha o exame como procedimento secundário. */
  contrast?: { code: string; name: string };
}

const CONTRASTE_TC = { code: "0206030045", name: "CONTRASTE P/ TOMOGRAFIA COMPUTADORIZADA" };
const CONTRASTE_RM = { code: "0206030053", name: "CONTRASTE P/ RESSONANCIA MAGNETICA" };

/**
 * Sugestões de procedimentos de imagem com APAC (códigos conferidos na Portaria SAES/MS nº 4.282/2026).
 * É só atalho: o médico pode digitar outro código SIGTAP e conferir o nome na tabela SIGTAP.
 */
export const OFICIAL_PROCEDURES: OficialProcedure[] = [
  { group: "Tomografia", code: "0206010079", name: "TOMOGRAFIA COMPUTADORIZADA DE CRANIO", contrast: CONTRASTE_TC },
  { group: "Tomografia", code: "0206020031", name: "TOMOGRAFIA COMPUTADORIZADA DE TORAX", contrast: CONTRASTE_TC },
  { group: "Tomografia", code: "0206030010", name: "TOMOGRAFIA COMPUTADORIZADA DE ABDOMEN SUPERIOR", contrast: CONTRASTE_TC },
  { group: "Tomografia", code: "0206010028", name: "TOMOGRAFIA COMPUTADORIZADA DE COLUNA LOMBO-SACRA", contrast: CONTRASTE_TC },
  { group: "Ressonância magnética", code: "0207010064", name: "RESSONANCIA MAGNETICA DE CRANIO", contrast: CONTRASTE_RM },
  { group: "Ressonância magnética", code: "0207020035", name: "RESSONANCIA MAGNETICA DE TORAX", contrast: CONTRASTE_RM },
  { group: "Ressonância magnética", code: "0207020060", name: "RESSONANCIA MAGNETICA DE MAMA (BILATERAL)", contrast: CONTRASTE_RM },
  { group: "Medicina nuclear", code: "0208010025", name: "CINTILOGRAFIA DE MIOCARDIO P/ AVALIACAO DA PERFUSAO EM SITUACAO DE ESTRESSE" },
  { group: "Medicina nuclear", code: "0208030026", name: "CINTILOGRAFIA DE TIREOIDE COM OU SEM CAPTACAO" },
  { group: "Medicina nuclear", code: "0208050019", name: "CINTILOGRAFIA DE ARTICULACOES E/OU EXTREMIDADES E/OU OSSO" },
];

/** Descrições curtas dos CIDs mais comuns em pedidos de imagem (sugestão para o campo 36; a médica pode editar). */
const CID_DESCRICOES: Record<string, string> = {
  R51: "CEFALEIA",
  G43: "ENXAQUECA",
  G44: "OUTRAS SINDROMES DE CEFALEIA",
  R55: "SINCOPE E COLAPSO",
  R56: "CONVULSOES",
  G40: "EPILEPSIA",
  I63: "INFARTO CEREBRAL",
  I64: "AVC NAO ESPECIFICADO",
  S06: "TRAUMATISMO INTRACRANIANO",
  R42: "TONTURA E INSTABILIDADE",
  J18: "PNEUMONIA",
  R91: "ACHADO ANORMAL EM EXAME DE IMAGEM DO PULMAO",
  R05: "TOSSE",
  R06: "ANORMALIDADES DA RESPIRACAO",
  I26: "EMBOLIA PULMONAR",
  R10: "DOR ABDOMINAL E PELVICA",
  K80: "COLELITIASE",
  K35: "APENDICITE AGUDA",
  N20: "CALCULOSE DO RIM E DO URETER",
  R16: "HEPATOMEGALIA E ESPLENOMEGALIA",
  M54: "DORSALGIA",
  M51: "TRANSTORNOS DE DISCOS INTERVERTEBRAIS",
  M47: "ESPONDILOSE",
  C34: "NEOPLASIA MALIGNA DOS BRONQUIOS E PULMOES",
  C50: "NEOPLASIA MALIGNA DA MAMA",
  E04: "OUTROS BOCIOS NAO TOXICOS",
  E05: "TIREOTOXICOSE",
  I25: "DOENCA ISQUEMICA CRONICA DO CORACAO",
};

/** Sugestão de descrição do diagnóstico a partir do CID-10 (ex.: "R51.9" -> "CEFALEIA"); vazio se não houver. */
export function sugerirDiagnostico(cid: string): string {
  const k = cid.trim().toUpperCase().slice(0, 3);
  return CID_DESCRICOES[k] ?? "";
}
