/**
 * Padroniza o texto livre de "especialidade" dos candidatos (captação) em nomes
 * únicos, pra filtros e dashboards não separarem "Clínica médica" de "Clínico geral".
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
  if (prof.startsWith("Nutricionista")) {
    if (/^nutricionista esportivo|^especialista em fitoterapia/.test(s)) return "Nutrição Esportiva";
    if (s.startsWith("emagrecimento")) return "Nutrição - Emagrecimento";
    if (s.includes("comportamental e transtornos")) return "Nutrição Comportamental";
    if (s.startsWith("funcional")) return "Nutrição Funcional";
    return "Nutrição Clínica";
  }
  if (prof.startsWith("Psicólogo")) return /tcc|cognitivo/.test(s) ? "Psicologia - TCC" : "Psicologia Clínica";
  if (prof.startsWith("Dentista")) return "Odontologia Clínica Geral";
  if (prof.startsWith("Enfermeiro")) return "Telessaúde";
  if (prof.startsWith("Farmac")) return "Farmácia Hospitalar";
  if (prof.startsWith("Fisioterapeuta")) return "Fisioterapia Geral";
  if (prof.startsWith("Fonoaudi")) return "Fonoaudiologia - Linguagem e TEA";
  if (s.startsWith("gerontologia")) return "Gerontologia";
  if (s.startsWith("neuropsic")) return "Neuropsicologia";
  return text || null;
}
