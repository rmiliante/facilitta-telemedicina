/**
 * Medicamentos ofertados pela Atenção Básica do município de Jacobina (lista da Secretaria de Saúde).
 * Formato por linha: ÁREA|CLASSE|NOME|CONCENTRAÇÃO|FORMA|DISP
 * DISP: N = NAPS, U = USF, F = Farmácia Básica, B = UBS.
 */
const RAW = `
Saúde mental|Antidepressivos|Amitriptilina|25 mg|Comprimido|N
Saúde mental|Antidepressivos|Bupropiona|150 mg|Comprimido de liberação prolongada|N
Saúde mental|Antidepressivos|Clomipramina|25 mg|Comprimido|N
Saúde mental|Antidepressivos|Fluoxetina|20 mg|Cápsula / comprimido|N
Saúde mental|Antidepressivos|Nortriptilina|25 mg|Cápsula|N
Saúde mental|Antidepressivos|Nortriptilina|50 mg|Cápsula|N
Saúde mental|Antidepressivos|Sertralina|50 mg|Comprimido|N
Saúde mental|Antipsicóticos e estabilizadores do humor|Haloperidol|1 mg|Comprimido|N
Saúde mental|Antipsicóticos e estabilizadores do humor|Haloperidol|5 mg|Comprimido|N
Saúde mental|Antipsicóticos e estabilizadores do humor|Haloperidol|5 mg/mL|Solução injetável|NU
Saúde mental|Antipsicóticos e estabilizadores do humor|Haloperidol decanoato|50 mg/mL|Solução injetável|N
Saúde mental|Antipsicóticos e estabilizadores do humor|Haloperidol|2 mg/mL|Solução oral|N
Saúde mental|Antipsicóticos e estabilizadores do humor|Clorpromazina|100 mg|Comprimido|N
Saúde mental|Antipsicóticos e estabilizadores do humor|Clorpromazina|5 mg/mL|Solução injetável|NU
Saúde mental|Antipsicóticos e estabilizadores do humor|Lítio carbonato|300 mg|Comprimido|N
Saúde mental|Antipsicóticos e estabilizadores do humor|Tioridazina|50 mg|Comprimido|N
Saúde mental|Antipsicóticos e estabilizadores do humor|Risperidona|1 mg|Comprimido|N
Saúde mental|Antipsicóticos e estabilizadores do humor|Risperidona|1 mg/mL|Solução oral|N
Saúde mental|Antipsicóticos e estabilizadores do humor|Risperidona|2 mg|Comprimido|N
Saúde mental|Antipsicóticos e estabilizadores do humor|Risperidona|3 mg|Comprimido|N
Saúde mental|Benzodiazepínicos|Clonazepam|0,5 mg|Comprimido|N
Saúde mental|Benzodiazepínicos|Clonazepam|2 mg|Comprimido|N
Saúde mental|Benzodiazepínicos|Clonazepam|2,5 mg/mL|Solução oral|N
Saúde mental|Benzodiazepínicos|Diazepam|10 mg|Comprimido|N
Saúde mental|Benzodiazepínicos|Diazepam|5 mg|Comprimido|N
Saúde mental|Benzodiazepínicos|Diazepam|5 mg/mL|Solução injetável|U
Saúde mental|Tratamento do tabagismo|Nicotina|7 mg|Adesivo transdérmico|N
Saúde mental|Tratamento do tabagismo|Nicotina|14 mg|Adesivo transdérmico|N
Saúde mental|Tratamento do tabagismo|Nicotina|21 mg|Adesivo transdérmico|N
Saúde mental|Tratamento do tabagismo|Nicotina|2 mg|Goma de mascar|N
Saúde mental|Anticolinérgico (saúde mental)|Biperideno cloridrato|2 mg|Comprimido|N
Saúde mental|Anticolinérgico (saúde mental)|Biperideno lactato|5 mg/mL|Solução injetável|NB
Alergia e inflamação|Corticosteroides|Beclometasona dipropionato|200 mcg/dose|Solução aerossol oral|FU
Alergia e inflamação|Corticosteroides|Beclometasona dipropionato|50 mcg/dose|Spray aquoso nasal|FU
Alergia e inflamação|Corticosteroides|Dexametasona|4 mg|Comprimido|FU
Alergia e inflamação|Corticosteroides|Dexametasona|2 mg/mL|Solução injetável|U
Alergia e inflamação|Corticosteroides|Dexametasona acetato|1 mg/g|Creme dermatológico|FU
Alergia e inflamação|Corticosteroides|Hidrocortisona|100 mg|Pó para reconstituição|U
Alergia e inflamação|Corticosteroides|Hidrocortisona|500 mg|Pó para reconstituição|U
Alergia e inflamação|Corticosteroides|Prednisona|5 mg|Comprimido|FU
Alergia e inflamação|Corticosteroides|Prednisona|20 mg|Comprimido|FU
Alergia e inflamação|Anti-histamínicos|Dexclorfeniramina|2 mg|Comprimido|FU
Alergia e inflamação|Anti-histamínicos|Dexclorfeniramina|0,4 mg/mL|Xarope|FU
Alergia e inflamação|Anti-histamínicos|Loratadina|10 mg|Comprimido|FU
Alergia e inflamação|Anti-histamínicos|Loratadina|1 mg/mL|Xarope|FU
Alergia e inflamação|Anti-histamínicos|Prometazina|25 mg|Comprimido|N
Alergia e inflamação|Anti-histamínicos|Prometazina|25 mg/mL|Solução injetável|U
Saúde da mulher|Anticoncepcionais|Levonorgestrel|0,75 mg|Comprimido|FU
Saúde da mulher|Anticoncepcionais|Noretisterona|0,35 mg|Comprimido|FU
Saúde da mulher|Anticoncepcionais|Medroxiprogesterona|150 mg/mL|Suspensão injetável|FU
Saúde da mulher|Anticoncepcionais|Noretisterona enantato + estradiol valerato|50 + 5 mg/mL|Solução injetável|FU
Saúde da mulher|Anticoncepcionais|Levonorgestrel + etinilestradiol|0,15 mg + 0,03 mg|Comprimido|FU
Saúde da mulher|Anticoncepcionais|Medroxiprogesterona acetato + estradiol cipionato|25 mg + 5 mg|Suspensão injetável|FU
Saúde da mulher|Imunoglobulina|Imunoglobulina humana G anti-D|300 mcg|Solução injetável|F
Cardiovascular|Bloqueadores adrenérgicos|Atenolol|25 mg|Comprimido|FU
Cardiovascular|Bloqueadores adrenérgicos|Atenolol|50 mg|Comprimido|FU
Cardiovascular|Bloqueadores adrenérgicos|Carvedilol|3,125 mg|Comprimido|FU
Cardiovascular|Bloqueadores adrenérgicos|Carvedilol|6,25 mg|Comprimido|FU
Cardiovascular|Bloqueadores adrenérgicos|Carvedilol|12,5 mg|Comprimido|FU
Cardiovascular|Bloqueadores adrenérgicos|Carvedilol|25 mg|Comprimido|FU
Cardiovascular|Bloqueadores adrenérgicos|Metoprolol succinato|25 mg|Comprimido|FU
Cardiovascular|Bloqueadores adrenérgicos|Metoprolol succinato|50 mg|Comprimido|FU
Cardiovascular|Bloqueadores adrenérgicos|Metoprolol succinato|100 mg|Comprimido|FU
Cardiovascular|Bloqueadores adrenérgicos|Propranolol|10 mg|Comprimido|FU
Cardiovascular|Bloqueadores adrenérgicos|Propranolol|40 mg|Comprimido|FU
Cardiovascular|Agonistas adrenérgicos de ação central|Metildopa|250 mg|Comprimido|FU
Cardiovascular|Nitratos orgânicos|Isossorbida|5 mg|Comprimido sublingual|FU
Cardiovascular|Nitratos orgânicos|Isossorbida|20 mg|Comprimido|FU
Cardiovascular|Nitratos orgânicos|Isossorbida|40 mg|Comprimido|FU
Cardiovascular|Agonistas adrenérgicos|Epinefrina|1 mg/mL|Solução injetável|U
Cardiovascular|Estatinas|Sinvastatina|20 mg|Comprimido|FU
Cardiovascular|Diuréticos|Hidroclorotiazida|25 mg|Comprimido|FU
Cardiovascular|Diuréticos|Espironolactona|25 mg|Comprimido|FU
Cardiovascular|Diuréticos|Furosemida|40 mg|Comprimido|FU
Cardiovascular|Diuréticos|Furosemida|10 mg/mL|Solução injetável|U
Cardiovascular|Inibidores da ECA|Captopril|25 mg|Comprimido|FU
Cardiovascular|Inibidores da ECA|Enalapril|5 mg|Comprimido|FU
Cardiovascular|Inibidores da ECA|Enalapril|10 mg|Comprimido|FU
Cardiovascular|Inibidores da ECA|Enalapril|20 mg|Comprimido|FU
Cardiovascular|Bloqueadores do receptor de angiotensina|Losartana|50 mg|Comprimido|FU
Cardiovascular|Bloqueadores de canal de cálcio|Anlodipino|5 mg|Comprimido|FU
Cardiovascular|Bloqueadores de canal de cálcio|Anlodipino|10 mg|Comprimido|FU
Cardiovascular|Glicosídeos digitálicos|Digoxina|0,25 mg|Comprimido|FU
Cardiovascular|Antiarrítmicos|Amiodarona|200 mg|Comprimido|FU
Cardiovascular|Antiarrítmicos|Lidocaína|20 mg/mL|Solução injetável|U
Infecções|Antibióticos|Amoxicilina|500 mg|Cápsula|FU
Infecções|Antibióticos|Amoxicilina|250 mg/5 mL|Pó para suspensão oral|FU
Infecções|Antibióticos|Amoxicilina + clavulanato de potássio|500 mg + 125 mg|Comprimido|FU
Infecções|Antibióticos|Amoxicilina + clavulanato de potássio|250 + 62,5 mg/5 mL|Pó para suspensão oral|FU
Infecções|Antibióticos|Azitromicina|500 mg|Comprimido|FU
Infecções|Antibióticos|Azitromicina|200 mg/5 mL|Pó para suspensão oral|FU
Infecções|Antibióticos|Benzilpenicilina benzatina|600.000 UI|Pó para reconstituição|FU
Infecções|Antibióticos|Benzilpenicilina benzatina|1.200.000 UI|Pó para reconstituição|FU
Infecções|Antibióticos|Ceftriaxona dissódica hemieptaidratada|1000 mg|Pó para reconstituição|FU
Infecções|Antibióticos|Ciprofloxacino|500 mg|Comprimido|FU
Infecções|Antibióticos|Cefalexina|500 mg|Comprimido|FU
Infecções|Antibióticos|Cefalexina|250 mg/5 mL|Pó para suspensão oral|FU
Infecções|Antibióticos|Sulfametoxazol + trimetoprima|400 mg + 80 mg|Comprimido|FU
Infecções|Antibióticos|Sulfametoxazol + trimetoprima|200 mg + 40 mg/5 mL|Suspensão oral|FU
Infecções|Antibióticos|Metronidazol|100 mg/g|Creme vaginal|FU
Infecções|Antibióticos|Metronidazol|250 mg|Comprimido|FU
Infecções|Antibióticos|Benzoilmetronidazol|40 mg/mL|Suspensão oral|FU
Infecções|Antibióticos|Neomicina sulfato + bacitracina zíncica|5 mg/g + 250 UI/g|Pomada dermatológica|FU
Infecções|Antifúngicos|Fluconazol|150 mg|Cápsula|FU
Infecções|Antifúngicos|Itraconazol|100 mg|Cápsula|FU
Infecções|Antifúngicos|Cetoconazol|20 mg/g|Creme dermatológico|FU
Infecções|Antifúngicos|Nistatina|100.000 UI/mL|Suspensão oral|FU
Infecções|Antifúngicos|Miconazol|20 mg/g|Creme vaginal|FU
Infecções|Antiparasitários e ectoparasiticidas|Albendazol|400 mg|Comprimido mastigável|FU
Infecções|Antiparasitários e ectoparasiticidas|Albendazol|40 mg/mL|Suspensão oral|FU
Infecções|Antiparasitários e ectoparasiticidas|Ivermectina|6 mg|Comprimido|FU
Infecções|Antiparasitários e ectoparasiticidas|Permetrina|1%|Loção|FU
Infecções|Antiparasitários e ectoparasiticidas|Permetrina|5%|Loção|FU
Infecções|Antivirais|Aciclovir|200 mg|Comprimido|FU
Infecções|Antivirais|Aciclovir|50 mg/g|Creme dermatológico|FU
Digestivo|Trato gastrointestinal e anticolinérgicos|Atropina sulfato|0,25 mg/mL|Solução injetável|U
Digestivo|Trato gastrointestinal e anticolinérgicos|Hidróxido de alumínio|6%|Suspensão oral|FU
Digestivo|Trato gastrointestinal e anticolinérgicos|Omeprazol|20 mg|Cápsula|FU
Digestivo|Trato gastrointestinal e anticolinérgicos|Omeprazol|40 mg|Pó para reconstituição|U
Digestivo|Trato gastrointestinal e anticolinérgicos|Escopolamina butilbrometo|10 mg|Drágea|FU
Digestivo|Trato gastrointestinal e anticolinérgicos|Escopolamina butilbrometo + dipirona|6,67 + 333,4 mg/mL|Solução oral|FU
Digestivo|Trato gastrointestinal e anticolinérgicos|Escopolamina butilbrometo|10 mg/mL|Solução oral|FU
Digestivo|Trato gastrointestinal e anticolinérgicos|Escopolamina butilbrometo|20 mg/mL|Solução injetável|U
Digestivo|Trato gastrointestinal e anticolinérgicos|Escopolamina butilbrometo + dipirona|4 + 500 mg/mL|Solução injetável|U
Digestivo|Trato gastrointestinal e anticolinérgicos|Lactulose|667 mg/mL|Solução oral|FU
Digestivo|Trato gastrointestinal e anticolinérgicos|Metoclopramida|10 mg|Comprimido|FU
Digestivo|Trato gastrointestinal e anticolinérgicos|Metoclopramida|4 mg/mL|Solução oral|FU
Digestivo|Trato gastrointestinal e anticolinérgicos|Metoclopramida|5 mg/mL|Solução injetável|U
Digestivo|Trato gastrointestinal e anticolinérgicos|Ondansetrona|2 mg/mL|Solução injetável|U
Digestivo|Trato gastrointestinal e anticolinérgicos|Sais para reidratação oral (NaCl + glicose + citrato Na + KCl)|27,9 g|Pó para reconstituição|FU
Digestivo|Trato gastrointestinal e anticolinérgicos|Simeticona|75 mg/mL|Emulsão oral|FU
Dor e inflamação|Anti-inflamatórios não esteroidais|Dipirona|500 mg|Comprimido|FU
Dor e inflamação|Anti-inflamatórios não esteroidais|Dipirona|500 mg/mL|Solução oral|FU
Dor e inflamação|Anti-inflamatórios não esteroidais|Dipirona|500 mg/mL|Solução injetável|U
Dor e inflamação|Anti-inflamatórios não esteroidais|Diclofenaco|50 mg|Comprimido|FU
Dor e inflamação|Anti-inflamatórios não esteroidais|Diclofenaco|25 mg/mL|Solução injetável|U
Dor e inflamação|Anti-inflamatórios não esteroidais|Ibuprofeno|600 mg|Comprimido|FU
Dor e inflamação|Anti-inflamatórios não esteroidais|Ibuprofeno|50 mg/mL|Solução oral|FU
Dor e inflamação|Anti-inflamatórios não esteroidais|Paracetamol|500 mg|Comprimido|FU
Dor e inflamação|Anti-inflamatórios não esteroidais|Paracetamol|100 mg/mL|Solução oral|FU
Dor e inflamação|Anti-inflamatórios não esteroidais|Cetoprofeno|50 mg/mL|Solução injetável|U
Dor e inflamação|Anti-inflamatórios não esteroidais|Cetoprofeno|100 mg/mL|Pó para reconstituição|U
Dor e inflamação|Opioides|Tramadol cloridrato|50 mg/mL|Solução injetável|U
Dor e inflamação|Gota e osteoporose|Alendronato de sódio|70 mg|Comprimido|FU
Dor e inflamação|Gota e osteoporose|Alopurinol|100 mg|Comprimido|FU
Sistema nervoso|Anestésicos|Lidocaína cloridrato|20 mg/mL|Solução injetável|FU
Sistema nervoso|Anestésicos|Lidocaína cloridrato + epinefrina|20 mg/mL + 0,005 mg/mL|Solução injetável|FU
Sistema nervoso|Anestésicos|Lidocaína cloridrato|20 mg/g|Gel|FU
Sistema nervoso|Antiparkinsonianos|Levodopa + benserazida|100 mg + 25 mg|Comprimido|FU
Sistema nervoso|Antiparkinsonianos|Levodopa + benserazida|100 mg + 25 mg|Cápsula de liberação prolongada|FU
Sistema nervoso|Antiparkinsonianos|Levodopa + benserazida|200 mg + 50 mg|Comprimido|FU
Sistema nervoso|Antiparkinsonianos|Levodopa + carbidopa|250 mg + 25 mg|Comprimido|FU
Sistema nervoso|Anticonvulsivantes|Ácido valproico|50 mg/mL|Xarope|N
Sistema nervoso|Anticonvulsivantes|Ácido valproico|500 mg|Comprimido|N
Sistema nervoso|Anticonvulsivantes|Ácido valproico|250 mg|Comprimido|N
Sistema nervoso|Anticonvulsivantes|Carbamazepina|20 mg/mL|Suspensão oral|N
Sistema nervoso|Anticonvulsivantes|Carbamazepina|200 mg|Comprimido|N
Sistema nervoso|Anticonvulsivantes|Fenobarbital|100 mg|Comprimido|N
Sistema nervoso|Anticonvulsivantes|Fenobarbital|40 mg/mL|Solução oral|N
Sistema nervoso|Anticonvulsivantes|Fenitoína|100 mg|Comprimido|N
Sistema nervoso|Anticonvulsivantes|Fenitoína|50 mg/mL|Solução injetável|U
Respiratório|Síndromes respiratórias|Ambroxol cloridrato|6 mg/mL|Xarope|FU
Respiratório|Síndromes respiratórias|Ambroxol cloridrato|3 mg/mL|Xarope|FU
Respiratório|Síndromes respiratórias|Salbutamol sulfato|0,48 mg/mL|Xarope|FU
Respiratório|Síndromes respiratórias|Salbutamol sulfato|100 mcg/dose|Suspensão aerossol oral|FU
Respiratório|Síndromes respiratórias|Ipratrópio brometo|0,25 mg/mL|Solução para inalação|FU
Vitaminas e sangue|Vitaminas, minerais e antianêmicos|Ácido ascórbico|100 mg/mL|Solução injetável|U
Vitaminas e sangue|Vitaminas, minerais e antianêmicos|Carbonato de cálcio + colecalciferol|1250 mg + 400 UI|Comprimido|FU
Vitaminas e sangue|Vitaminas, minerais e antianêmicos|Cálcio|1250 mg|Comprimido|FU
Vitaminas e sangue|Vitaminas, minerais e antianêmicos|Ácido fólico|5 mg|Comprimido|FU
Vitaminas e sangue|Vitaminas, minerais e antianêmicos|Ácido fólico|0,2 mg/mL|Solução oral|FU
Vitaminas e sangue|Vitaminas, minerais e antianêmicos|Complexo B (B1-B2-B3-B5-B6)||Solução injetável|U
Vitaminas e sangue|Vitaminas, minerais e antianêmicos|Complexo B (B1-B2-B3-B5-B6-B12)|0,2 g|Comprimido|FU
Vitaminas e sangue|Vitaminas, minerais e antianêmicos|Complexo B (B1-B2-B3-B5-B6-B12)||Solução oral|FU
Vitaminas e sangue|Vitaminas, minerais e antianêmicos|Sulfato ferroso|25 mg/mL|Solução oral|FU
Vitaminas e sangue|Vitaminas, minerais e antianêmicos|Sulfato ferroso|40 mg|Comprimido|FU
Vitaminas e sangue|Sistema hematopoiético|Ácido tranexâmico|50 mg/mL|Solução injetável|U
Vitaminas e sangue|Sistema hematopoiético|Fitomenadiona (vitamina K)|10 mg/mL|Solução injetável|U
Endócrino e diabetes|Antidiabéticos orais|Gliclazida|30 mg|Comprimido de liberação prolongada|FU
Endócrino e diabetes|Antidiabéticos orais|Glibenclamida|5 mg|Comprimido|FU
Endócrino e diabetes|Antidiabéticos orais|Metformina|850 mg|Comprimido|FU
Endócrino e diabetes|Insulina e insumos|Insulina NPH|100 UI/mL|Solução injetável|FU
Endócrino e diabetes|Insulina e insumos|Insulina regular|100 UI/mL|Solução injetável|FU
Endócrino e diabetes|Insulina e insumos|Lancetas|||FU
Endócrino e diabetes|Insulina e insumos|Tira reagente|||FU
Endócrino e diabetes|Insulina e insumos|Glicosímetro|||U
Endócrino e diabetes|Terapia tireoidiana|Levotiroxina sódica|25 mcg|Comprimido|FU
Endócrino e diabetes|Terapia tireoidiana|Levotiroxina sódica|50 mcg|Comprimido|FU
Endócrino e diabetes|Terapia tireoidiana|Levotiroxina sódica|100 mcg|Comprimido|FU
`;

export type BasicPlace = "Farmácia Básica" | "USF" | "NAPS" | "UBS";

export interface BasicMed {
  area: string;
  classe: string;
  nome: string;
  conc: string;
  forma: string;
  where: BasicPlace[];
  /** Medicamento de receita controlada (aviso na lista). */
  controlled: boolean;
}

const PLACE: Record<string, BasicPlace> = { F: "Farmácia Básica", U: "USF", N: "NAPS", B: "UBS" };
const CONTROLLED_CLASSES = ["Benzodiazepínicos", "Opioides"];

export const BASIC_MEDS: BasicMed[] = RAW.trim()
  .split("\n")
  .map((line) => line.split("|"))
  .filter((p) => p.length === 6)
  .map(([area, classe, nome, conc, forma, disp]) => ({
    area,
    classe,
    nome,
    conc,
    forma,
    where: disp.split("").map((c) => PLACE[c]).filter(Boolean),
    controlled: CONTROLLED_CLASSES.includes(classe) || nome.toLowerCase().startsWith("fenobarbital"),
  }));

export const BASIC_PLACES: BasicPlace[] = ["Farmácia Básica", "USF", "NAPS", "UBS"];

export const BASIC_AREAS: string[] = Array.from(new Set(BASIC_MEDS.map((m) => m.area)));

export function basicClasses(area: string | null): string[] {
  return Array.from(new Set(BASIC_MEDS.filter((m) => !area || m.area === area).map((m) => m.classe)));
}

/** Agrupa as formas em categorias simples pro filtro. */
export type FormaGroup = "Comprimido / cápsula" | "Xarope / solução oral" | "Injetável" | "Creme / pomada / gel" | "Outras";
export const FORMA_GROUPS: FormaGroup[] = ["Comprimido / cápsula", "Xarope / solução oral", "Injetável", "Creme / pomada / gel", "Outras"];

export function formaGroup(forma: string): FormaGroup {
  const f = forma.toLowerCase();
  if (f.includes("injet") || f.includes("pó para reconst")) return "Injetável";
  if (f.includes("comprimido") || f.includes("cápsula") || f.includes("drágea")) return "Comprimido / cápsula";
  if (f.includes("xarope") || f.includes("solução oral") || f.includes("suspensão oral") || f.includes("pó para suspensão") || f.includes("emulsão oral"))
    return "Xarope / solução oral";
  if (f.includes("creme") || f.includes("pomada") || f.includes("gel") || f.includes("loção")) return "Creme / pomada / gel";
  return "Outras";
}

function plain(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function medLabel(m: BasicMed): string {
  return [m.nome, m.conc].filter(Boolean).join(" ") + (m.forma ? ` — ${m.forma}` : "");
}

export function filterBasicMeds(f: {
  q: string;
  place: BasicPlace | null;
  area: string | null;
  classe: string | null;
  forma: FormaGroup | null;
}): BasicMed[] {
  const tokens = plain(f.q).split(/\s+/).filter(Boolean);
  return BASIC_MEDS.filter((m) => {
    if (f.place && !m.where.includes(f.place)) return false;
    if (f.area && m.area !== f.area) return false;
    if (f.classe && m.classe !== f.classe) return false;
    if (f.forma && formaGroup(m.forma) !== f.forma) return false;
    if (tokens.length) {
      const hay = plain(`${m.nome} ${m.classe} ${m.area} ${m.forma}`);
      if (!tokens.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
}
