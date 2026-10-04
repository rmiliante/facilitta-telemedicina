/**
 * Medicamentos que NÃO podem sair na receita digital comum do sistema
 * (Portaria SVS/MS 344/98, RDC 471/2021 e RDC 1.000/2025 — SNCR).
 *
 * - "notificacao": exige Notificação de Receita (amarela A, azul B ou
 *   especial de retinoides/talidomida). Nunca vale em receita comum.
 * - "controle_especial": Receita de Controle Especial (lista C1 e
 *   afins). Em formato digital, a partir de 30/10/2026 só vale se
 *   emitida em plataforma integrada ao SNCR.
 * - "retencao": receita retida na farmácia (antimicrobianos e agonistas
 *   de GLP-1). Mesma regra do SNCR a partir de 30/10/2026.
 *
 * A lista cobre as substâncias mais prescritas, não todas as listas da
 * Portaria 344 — é um alerta de apoio; a responsabilidade pela
 * prescrição continua sendo do médico.
 */

export type ControlCategory = "notificacao" | "controle_especial" | "retencao";

/** Primeiro dia em que receita branca digital de controle/retenção precisa do SNCR. */
export const SNCR_DEADLINE = "2026-10-30";

const SUBSTANCES: Record<ControlCategory, string[]> = {
  notificacao: [
    // Lista A (amarela): entorpecentes e psicotrópicos A3
    "morfina", "metadona", "fentanil", "fentanila", "oxicodona", "hidromorfona", "petidina", "meperidina",
    "buprenorfina", "metilfenidato", "lisdexanfetamina", "anfetamina", "dexanfetamina",
    // Lista B1/B2 (azul)
    "alprazolam", "bromazepam", "clonazepam", "diazepam", "lorazepam", "midazolam", "nitrazepam",
    "flunitrazepam", "clobazam", "cloxazolam", "estazolam", "flurazepam", "clordiazepoxido",
    "zolpidem", "zopiclona", "eszopiclona", "fenobarbital",
    "sibutramina", "anfepramona", "femproporex", "mazindol",
    // Notificação especial (C2 retinoides, C3 talidomida)
    "isotretinoina", "acitretina", "talidomida",
  ],
  controle_especial: [
    // Antidepressivos
    "amitriptilina", "nortriptilina", "imipramina", "clomipramina", "fluoxetina", "sertralina", "paroxetina",
    "citalopram", "escitalopram", "fluvoxamina", "venlafaxina", "desvenlafaxina", "duloxetina", "bupropiona",
    "mirtazapina", "trazodona", "vortioxetina", "agomelatina",
    // Anticonvulsivantes / estabilizadores
    "carbamazepina", "oxcarbazepina", "valproico", "valproato", "divalproato", "lamotrigina", "topiramato",
    "gabapentina", "pregabalina", "levetiracetam", "fenitoina", "lacosamida", "litio",
    // Antipsicóticos
    "haloperidol", "risperidona", "quetiapina", "olanzapina", "aripiprazol", "clozapina", "ziprasidona",
    "clorpromazina", "levomepromazina", "paliperidona", "lurasidona",
    // Outros C1 / opioides de controle especial
    "tramadol", "codeina", "tapentadol", "biperideno", "dissulfiram", "naltrexona",
  ],
  retencao: [
    // Antimicrobianos (RDC 471/2021)
    "amoxicilina", "ampicilina", "penicilina", "benzilpenicilina", "azitromicina", "claritromicina",
    "eritromicina", "cefalexina", "cefadroxila", "cefuroxima", "cefaclor", "ceftriaxona", "cefixima",
    "cefazolina", "ciprofloxacino", "levofloxacino", "moxifloxacino", "norfloxacino", "ofloxacino",
    "doxiciclina", "minociclina", "tetraciclina", "sulfametoxazol", "trimetoprima", "nitrofurantoina",
    "fosfomicina", "metronidazol", "secnidazol", "tinidazol", "clindamicina", "linezolida", "rifampicina",
    "isoniazida", "vancomicina", "gentamicina", "amicacina",
    // Agonistas de GLP-1 (retenção de receita)
    "semaglutida", "liraglutida", "tirzepatida", "dulaglutida", "exenatida", "lixisenatida",
  ],
};

export const CATEGORY_LABEL: Record<ControlCategory, string> = {
  notificacao: "Exige Notificação de Receita (amarela/azul)",
  controle_especial: "Receita de controle especial",
  retencao: "Receita retida (antimicrobiano / GLP-1)",
};

function plain(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Classifica o medicamento pelo nome (substância). null = receita comum. */
export function classifyMedication(name: string): { category: ControlCategory; substance: string } | null {
  const text = ` ${plain(name).replace(/[^a-z0-9]+/g, " ")} `;
  // Ordem importa: notificação é a regra mais restrita.
  for (const category of ["notificacao", "controle_especial", "retencao"] as ControlCategory[]) {
    for (const substance of SUBSTANCES[category]) {
      if (text.includes(` ${substance}`)) return { category, substance };
    }
  }
  return null;
}

/** Data de hoje (YYYY-MM-DD) em São Paulo. */
function todaySaoPaulo(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export interface ControlledCheck {
  name: string;
  category: ControlCategory;
  substance: string;
  /** true = a emissão digital por este sistema não é permitida. */
  blocked: boolean;
  message: string;
}

/** Confere os itens de uma receita e diz o que avisar ou bloquear. */
export function checkPrescription(itemNames: string[], now = new Date()): ControlledCheck[] {
  const afterDeadline = todaySaoPaulo(now) >= SNCR_DEADLINE;
  const out: ControlledCheck[] = [];
  for (const name of itemNames) {
    const hit = classifyMedication(name);
    if (!hit) continue;
    if (hit.category === "notificacao") {
      out.push({
        name,
        ...hit,
        blocked: true,
        message: `${name}: exige Notificação de Receita (talão amarelo/azul ou plataforma integrada ao SNCR). Não pode sair nesta receita.`,
      });
    } else {
      out.push({
        name,
        ...hit,
        blocked: afterDeadline,
        message: afterDeadline
          ? `${name}: ${hit.category === "retencao" ? "receita retida" : "controle especial"} — desde 30/10/2026 a versão digital precisa ser emitida em plataforma integrada ao SNCR. Use receituário em papel (2 vias).`
          : `${name}: ${hit.category === "retencao" ? "receita retida na farmácia" : "controle especial (2 vias)"}. A partir de 30/10/2026 a versão digital só vale integrada ao SNCR; a farmácia pode recusar.`,
      });
    }
  }
  return out;
}
