/**
 * Padroniza o texto livre de "especialidade" dos candidatos (captação) em dois níveis:
 * - especialidade (a área): Nutrição, Psicologia, Clínica Médica, Pediatria...
 * - especializações (vários): Emagrecimento, Esportiva, TCC, Saúde Mental...
 * O texto original fica guardado em specialty_raw.
 */
export function normalizeSpecialty(profession: string | null | undefined, raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  const prof = (profession ?? "Médico(a)").trim();
  const s = text.toLowerCase();

  if (prof.startsWith("Médico")) {
    if (!text) return null;
    if (/(^|[^a-z])mfc([^a-z]|$)|medicina da fam[ií]lia|fam[ií]lia e comunidade/.test(s)) return "Medicina de Família e Comunidade";
    if (s.includes("ortopedia")) return "Ortopedia e Traumatologia";
    if (s.startsWith("psiquiatria")) return "Psiquiatria";
    if (s.startsWith("geriatria")) return "Geriatria";
    if (s.startsWith("nutrologia")) return "Nutrologia";
    if (s.startsWith("neurologia")) return "Neurologia";
    if (s.startsWith("pediatr")) return "Pediatria";
    if (/cl[ií]nic|generalista|sa[uú]de mental/.test(s)) return "Clínica Médica";
    return text;
  }
  if (prof.startsWith("Nutricionista")) return "Nutrição";
  if (prof.startsWith("Psicólogo")) return "Psicologia";
  if (prof.startsWith("Dentista")) return "Odontologia";
  if (prof.startsWith("Enfermeiro")) return "Enfermagem";
  if (prof.startsWith("Farmac")) return "Farmácia";
  if (prof.startsWith("Fisioterapeuta")) return "Fisioterapia";
  if (prof.startsWith("Fonoaudi")) return "Fonoaudiologia";
  if (s.startsWith("gerontologia")) return "Gerontologia";
  if (s.startsWith("neuropsic")) return "Neuropsicologia";
  return text || null;
}

/** Especializações detectadas no texto digitado (e, para médicos, urgência/emergência nos comentários). */
export function specializationsOf(
  profession: string | null | undefined,
  raw: string | null | undefined,
  comments?: string | null
): string[] {
  const prof = (profession ?? "Médico(a)").trim();
  const r = (raw ?? "").toLowerCase();
  const c = (comments ?? "").toLowerCase();
  const nutri = prof.startsWith("Nutricionista");
  const psi = prof.startsWith("Psicólogo");
  const med = prof.startsWith("Médico");
  const out: (string | false)[] = [
    (nutri || psi) && /cl[ií]nic/.test(r) && "Clínica",
    nutri && /emagrec|canetas/.test(r) && "Emagrecimento",
    nutri && /esport/.test(r) && "Esportiva",
    /fitoter/.test(r) && "Fitoterapia",
    nutri && /funcional/.test(r) && "Funcional",
    nutri && /comportamental/.test(r) && "Comportamental",
    /est[ée]tic/.test(r) && "Estética",
    /sa[úu]de da mulher/.test(r) && "Saúde da Mulher",
    (nutri && /hospitalar/.test(r)) || (prof.startsWith("Farmac") && "Hospitalar") ? "Hospitalar" : false,
    nutri && /geri[áa]tr/.test(r) && "Geriátrica",
    /(^|[^a-z])tea([^a-z]|$)/.test(r) && "TEA",
    /reeduca/.test(r) && "Reeducação Alimentar",
    /p[óo]s bari/.test(r) && "Pós-bariátrica",
    /transtornos alimentares/.test(r) && "Transtornos Alimentares",
    nutri && /endocrin/.test(r) && "Endocrinologia",
    nutri && /gastro/.test(r) && "Gastroenterologia",
    nutri && /nefro/.test(r) && "Nefrologia",
    /doen[çc]as cr[ôo]nicas/.test(r) && "Doenças Crônicas",
    psi && /tcc|cognitivo/.test(r) && "TCC",
    /psicopedagog/.test(r) && "Psicopedagogia",
    !nutri && /sa[úu]de mental/.test(r) && "Saúde Mental",
    med && /paliativ/.test(r) && "Cuidados Paliativos",
    med && /medicina do trabalho/.test(r) && "Medicina do Trabalho",
    med && /neuropediatria/.test(r) && "Neuropediatria",
    med && !/^pediatr/.test(r) && /pediatr/.test(r) && "Pediatria",
    med && /urg[êe]ncia|emerg[êe]ncia/.test(c) && "Urgência e Emergência",
    /ortodontia/.test(r) && "Ortodontia",
    prof.startsWith("Fonoaudi") && "Linguagem",
    r.startsWith("gerontologia") && "Neurociência",
  ];
  return out.filter((x): x is string => !!x);
}
