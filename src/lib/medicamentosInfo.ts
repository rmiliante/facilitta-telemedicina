/**
 * Catálogo de referência (resumido) dos medicamentos mais prescritos, usado no popup do
 * dashboard de Prescrições. Texto informativo; não substitui bula nem julgamento médico.
 * Medicamento fora do catálogo mostra só o tipo de receita e os números da Facilitta.
 */
export interface MedInfo {
  classe: string;
  uso: string;
  serve: string;
  atencao: string;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// chave = princípio ativo (sem acento). O nome prescrito é comparado por "contém".
const CATALOGO: Record<string, MedInfo> = {
  dipirona: { classe: "Analgésico e antitérmico", uso: "oral/injetável", serve: "Dor e febre.", atencao: "Evitar em alergia a dipirona; raramente causa queda de leucócitos (agranulocitose)." },
  paracetamol: { classe: "Analgésico e antitérmico", uso: "oral", serve: "Dor leve a moderada e febre.", atencao: "Respeitar a dose máxima diária; risco ao fígado em excesso." },
  ibuprofeno: { classe: "Anti-inflamatório (AINE)", uso: "oral", serve: "Dor, febre e inflamação.", atencao: "Tomar com alimento; cautela em problemas gástricos, renais e hipertensão." },
  diclofenaco: { classe: "Anti-inflamatório (AINE)", uso: "oral/injetável/tópico", serve: "Dor e inflamação (musculoesquelética, cólicas).", atencao: "Cautela em doença gástrica, renal e cardiovascular." },
  nimesulida: { classe: "Anti-inflamatório (AINE)", uso: "oral", serve: "Dor e inflamação de curta duração.", atencao: "Uso por curto período; atenção ao fígado." },
  cetoprofeno: { classe: "Anti-inflamatório (AINE)", uso: "oral", serve: "Dor e inflamação.", atencao: "Cautela em doença gástrica e renal." },
  omeprazol: { classe: "Protetor gástrico (inibidor de bomba de prótons)", uso: "oral", serve: "Gastrite, refluxo e proteção do estômago.", atencao: "Uso prolongado deve ter indicação." },
  pantoprazol: { classe: "Protetor gástrico (inibidor de bomba de prótons)", uso: "oral", serve: "Gastrite, refluxo e úlcera.", atencao: "Uso prolongado deve ter indicação." },
  ondansetrona: { classe: "Antiemético", uso: "oral", serve: "Náuseas e vômitos.", atencao: "Pode prolongar o intervalo QT." },
  metoclopramida: { classe: "Antiemético / procinético", uso: "oral/injetável", serve: "Náuseas, vômitos e má digestão.", atencao: "Pode causar movimentos involuntários; uso curto." },
  loratadina: { classe: "Anti-histamínico", uso: "oral", serve: "Rinite alérgica e urticária.", atencao: "Pouca sonolência." },
  desloratadina: { classe: "Anti-histamínico", uso: "oral", serve: "Rinite alérgica e urticária.", atencao: "Pouca sonolência." },
  prednisona: { classe: "Corticoide", uso: "oral", serve: "Inflamações, alergias e doenças autoimunes.", atencao: "Não suspender de forma brusca em uso prolongado; eleva glicemia e pressão." },
  prednisolona: { classe: "Corticoide", uso: "oral", serve: "Inflamações e alergias.", atencao: "Mesmos cuidados dos corticoides orais." },
  dexametasona: { classe: "Corticoide", uso: "oral/injetável", serve: "Inflamações e alergias intensas.", atencao: "Eleva glicemia e pressão; evitar uso prolongado sem acompanhamento." },
  losartana: { classe: "Anti-hipertensivo (BRA)", uso: "oral", serve: "Hipertensão e proteção renal/cardíaca.", atencao: "Contraindicada na gravidez; monitorar potássio e rim." },
  enalapril: { classe: "Anti-hipertensivo (IECA)", uso: "oral", serve: "Hipertensão e insuficiência cardíaca.", atencao: "Pode causar tosse seca; contraindicado na gravidez." },
  atenolol: { classe: "Betabloqueador", uso: "oral", serve: "Hipertensão, arritmias e angina.", atencao: "Não suspender bruscamente; cautela em asma." },
  propranolol: { classe: "Betabloqueador", uso: "oral", serve: "Hipertensão, tremor, enxaqueca e ansiedade de desempenho.", atencao: "Cautela em asma e bradicardia." },
  anlodipino: { classe: "Anti-hipertensivo (bloqueador de canal de cálcio)", uso: "oral", serve: "Hipertensão e angina.", atencao: "Pode causar inchaço nas pernas." },
  hidroclorotiazida: { classe: "Diurético", uso: "oral", serve: "Hipertensão e retenção de líquidos.", atencao: "Monitorar sódio, potássio e glicemia." },
  metformina: { classe: "Antidiabético", uso: "oral", serve: "Diabetes tipo 2.", atencao: "Tomar com refeição; cautela em doença renal." },
  sinvastatina: { classe: "Hipolipemiante (estatina)", uso: "oral", serve: "Colesterol alto e prevenção cardiovascular.", atencao: "Relatar dor muscular; monitorar fígado." },
  atorvastatina: { classe: "Hipolipemiante (estatina)", uso: "oral", serve: "Colesterol alto e prevenção cardiovascular.", atencao: "Relatar dor muscular; monitorar fígado." },
  levotiroxina: { classe: "Hormônio tireoidiano", uso: "oral", serve: "Hipotireoidismo.", atencao: "Tomar em jejum, longe de cálcio e ferro." },
  amoxicilina: { classe: "Antibiótico (penicilina)", uso: "oral", serve: "Infecções de garganta, ouvido, sinusite, urinárias e respiratórias.", atencao: "Alergia a penicilinas; completar o tratamento." },
  azitromicina: { classe: "Antibiótico (macrolídeo)", uso: "oral", serve: "Infecções respiratórias, de garganta e alguns tipos de infecção sexualmente transmissível.", atencao: "Pode prolongar o intervalo QT." },
  cefalexina: { classe: "Antibiótico (cefalosporina)", uso: "oral", serve: "Infecções de pele e urinárias.", atencao: "Cautela em alergia a penicilina." },
  ciprofloxacino: { classe: "Antibiótico (quinolona)", uso: "oral", serve: "Infecções urinárias e intestinais.", atencao: "Risco de lesão em tendões; evitar em gestantes." },
  metronidazol: { classe: "Antibiótico/antiparasitário", uso: "oral", serve: "Infecções por anaeróbios, giardíase e vaginose.", atencao: "Evitar álcool durante o uso." },
  sulfametoxazol: { classe: "Antibiótico (sulfa)", uso: "oral", serve: "Infecções urinárias e respiratórias.", atencao: "Alergia a sulfa; boa hidratação." },
  fluconazol: { classe: "Antifúngico", uso: "oral", serve: "Candidíase e outras micoses.", atencao: "Interage com vários medicamentos." },
  semaglutida: { classe: "Agonista de GLP-1", uso: "injetável", serve: "Diabetes tipo 2 e controle de peso (conforme a apresentação).", atencao: "Náuseas são comuns; cautela em pancreatite." },
  tirzepatida: { classe: "Agonista de GIP/GLP-1", uso: "injetável", serve: "Diabetes tipo 2 e controle de peso.", atencao: "Náuseas são comuns; cautela em pancreatite." },
  liraglutida: { classe: "Agonista de GLP-1", uso: "injetável", serve: "Diabetes tipo 2 e controle de peso.", atencao: "Náuseas são comuns; cautela em pancreatite." },
  sertralina: { classe: "Antidepressivo (ISRS)", uso: "oral", serve: "Depressão, ansiedade, pânico e TOC.", atencao: "O efeito leva semanas; não suspender de forma brusca." },
  fluoxetina: { classe: "Antidepressivo (ISRS)", uso: "oral", serve: "Depressão, TOC e bulimia.", atencao: "Pode causar insônia ou agitação no início." },
  escitalopram: { classe: "Antidepressivo (ISRS)", uso: "oral", serve: "Depressão e transtornos de ansiedade.", atencao: "Pode prolongar o intervalo QT; não suspender bruscamente." },
  paroxetina: { classe: "Antidepressivo (ISRS)", uso: "oral", serve: "Depressão, ansiedade e pânico.", atencao: "Síndrome de descontinuação se suspenso bruscamente." },
  amitriptilina: { classe: "Antidepressivo (tricíclico)", uso: "oral", serve: "Depressão, dor neuropática e prevenção de enxaqueca.", atencao: "Sonolência e boca seca; cautela em cardiopatas e idosos." },
  trazodona: { classe: "Antidepressivo", uso: "oral", serve: "Depressão e insônia associada.", atencao: "Sonolência." },
  bupropiona: { classe: "Antidepressivo", uso: "oral", serve: "Depressão e auxílio para parar de fumar.", atencao: "Contraindicada em histórico de convulsões." },
  venlafaxina: { classe: "Antidepressivo (IRSN)", uso: "oral", serve: "Depressão e ansiedade.", atencao: "Pode elevar a pressão; não suspender bruscamente." },
  duloxetina: { classe: "Antidepressivo (IRSN)", uso: "oral", serve: "Depressão, ansiedade e dor neuropática.", atencao: "Náuseas no início; não suspender bruscamente." },
  risperidona: { classe: "Antipsicótico atípico", uso: "oral", serve: "Esquizofrenia, mania no transtorno bipolar e irritabilidade no autismo.", atencao: "Sonolência, ganho de peso e aumento de prolactina." },
  quetiapina: { classe: "Antipsicótico atípico", uso: "oral", serve: "Esquizofrenia, transtorno bipolar e, em doses baixas, insônia (uso off-label).", atencao: "Sonolência e ganho de peso; monitorar glicemia e colesterol." },
  olanzapina: { classe: "Antipsicótico atípico", uso: "oral", serve: "Esquizofrenia e transtorno bipolar.", atencao: "Ganho de peso e alteração metabólica." },
  aripiprazol: { classe: "Antipsicótico atípico", uso: "oral", serve: "Esquizofrenia, transtorno bipolar e adjuvante na depressão.", atencao: "Pode causar inquietação (acatisia)." },
  haloperidol: { classe: "Antipsicótico típico", uso: "oral/injetável", serve: "Esquizofrenia, agitação e tiques.", atencao: "Risco de rigidez e movimentos involuntários." },
  lamotrigina: { classe: "Estabilizador de humor / anticonvulsivante", uso: "oral", serve: "Epilepsia e transtorno bipolar.", atencao: "Risco de reação grave na pele; aumentar a dose gradualmente." },
  carbamazepina: { classe: "Anticonvulsivante / estabilizador", uso: "oral", serve: "Epilepsia, neuralgia do trigêmeo e transtorno bipolar.", atencao: "Interage com muitos medicamentos; monitorar sangue e fígado." },
  topiramato: { classe: "Anticonvulsivante", uso: "oral", serve: "Epilepsia e prevenção de enxaqueca.", atencao: "Pode causar formigamento e lentidão cognitiva." },
  gabapentina: { classe: "Anticonvulsivante / dor neuropática", uso: "oral", serve: "Dor neuropática e epilepsia.", atencao: "Sonolência e tontura." },
  pregabalina: { classe: "Dor neuropática / anticonvulsivante", uso: "oral", serve: "Dor neuropática, fibromialgia e ansiedade generalizada.", atencao: "Sonolência e tontura." },
  tramadol: { classe: "Analgésico opioide", uso: "oral/injetável", serve: "Dor moderada a intensa.", atencao: "Risco de dependência e de convulsão; sonolência." },
  clonazepam: { classe: "Benzodiazepínico", uso: "oral", serve: "Transtorno de pânico, ansiedade e epilepsia.", atencao: "Risco de dependência e sedação; não suspender bruscamente." },
  alprazolam: { classe: "Benzodiazepínico", uso: "oral", serve: "Ansiedade e pânico.", atencao: "Risco de dependência e sedação; não suspender bruscamente." },
  diazepam: { classe: "Benzodiazepínico", uso: "oral/injetável", serve: "Ansiedade, espasmos musculares e convulsões.", atencao: "Risco de dependência e sedação." },
  zolpidem: { classe: "Hipnótico", uso: "oral", serve: "Insônia.", atencao: "Uso curto; pode causar sonambulismo e amnésia." },
  metilfenidato: { classe: "Psicoestimulante", uso: "oral", serve: "TDAH e narcolepsia.", atencao: "Pode elevar pressão e frequência cardíaca; reduz o apetite." },
  lisdexanfetamina: { classe: "Psicoestimulante", uso: "oral", serve: "TDAH e compulsão alimentar.", atencao: "Pode elevar pressão e frequência cardíaca; reduz o apetite." },
  litio: { classe: "Estabilizador de humor", uso: "oral", serve: "Transtorno bipolar.", atencao: "Faixa terapêutica estreita; monitorar litemia e função renal." },
};

export function infoDoMedicamento(nome: string): MedInfo | null {
  const n = norm(nome);
  for (const [k, v] of Object.entries(CATALOGO)) if (n.includes(k)) return v;
  return null;
}
