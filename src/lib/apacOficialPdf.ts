import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { PrescriptionPdfInput } from "@/lib/prescriptionPdf";
import { formatSigtap } from "@/lib/apacOficial";

/**
 * Laudo para Solicitação/Autorização de Procedimento Ambulatorial (APAC), no modelo do
 * Ministério da Saúde (SIA/SUS), com os campos numerados de 1 a 55 na mesma ordem do
 * formulário impresso. O bloco do autorizador e o do executante saem em branco (regulação).
 */

const ESTABELECIMENTO = process.env.APAC_ESTABELECIMENTO || "POLO INTEGRADO DE SAÚDE DE JACOBINA";
const CNES = process.env.APAC_CNES || "6117252";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 28;
const FILL = rgb(0x0b / 255, 0x3d / 255, 0x91 / 255);
const BLACK = rgb(0, 0, 0);
const MUTED = rgb(0.32, 0.32, 0.32);
const LINE = rgb(0.84, 0.82, 0.78);
const INK = rgb(0.11, 0.09, 0.19);
const BAR = rgb(0.2, 0.2, 0.2);
const BORDER = rgb(0.2, 0.2, 0.2);
const WHITE = rgb(1, 1, 1);

function safe(font: PDFFont, text: string) {
  let out = "";
  for (const ch of text.replace(/\r/g, "").replace(/\t/g, " ")) {
    try {
      font.encodeText(ch);
      out += ch === "\n" ? " " : ch;
    } catch {
      /* ignora caractere que a fonte não suporta */
    }
  }
  return out;
}

function wrap(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const words = safe(font, text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(cand, size) <= maxW) line = cand;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function dmy(iso?: string | null) {
  const [y, m, d] = (iso ?? "").slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}

function formatIssued(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(",", "");
}

function formatCpf(v: string) {
  const d = v.replace(/\D/g, "");
  return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : v;
}

/** Separa DDD e número de um telefone brasileiro digitado de qualquer jeito. */
function splitPhone(v: string): { ddd: string; num: string } {
  let d = v.replace(/\D/g, "");
  if (d.startsWith("55") && d.length > 11) d = d.slice(2);
  if (d.length >= 10) return { ddd: d.slice(0, 2), num: d.slice(2).replace(/(\d{4,5})(\d{4})$/, "$1-$2") };
  return { ddd: "", num: d ? d.replace(/(\d{4,5})(\d{4})$/, "$1-$2") : "" };
}

export async function buildApacOficialPdf(input: PrescriptionPdfInput, opts: { preview?: boolean } = {}): Promise<Uint8Array> {
  const a = input.apac!;
  const of = a.oficial!;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Laudo para solicitação de procedimento ambulatorial (APAC) - ${input.patient.name}`);
  pdf.setAuthor(input.doctor.name);
  pdf.setCreator("Receituário digital");
  pdf.setProducer("Receituário digital");
  pdf.setLanguage("pt-BR");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const W = PAGE_W - MARGIN * 2;

  const text = (t: string, x: number, yy: number, size: number, font = regular, color = BLACK) =>
    page.drawText(safe(font, t), { x, y: yy, size, font, color });
  const center = (t: string, cx: number, yy: number, size: number, font: PDFFont, color = BLACK) => {
    const s = safe(font, t);
    page.drawText(s, { x: cx - font.widthOfTextAtSize(s, size) / 2, y: yy, size, font, color });
  };
  const rect = (x: number, yy: number, w: number, h: number, thickness = 0.6) =>
    page.drawRectangle({ x, y: yy, width: w, height: h, borderColor: BORDER, borderWidth: thickness });

  let y = PAGE_H - MARGIN;

  // Cabeçalho: bloco SUS / Ministério da Saúde, título e "fls."
  const HH = 46;
  rect(MARGIN, y - HH, 128, HH, 1);
  text("SUS", MARGIN + 7, y - 31, 20, bold, BLACK);
  text("Sistema", MARGIN + 54, y - 15, 7, bold);
  text("Único de", MARGIN + 54, y - 24, 7, bold);
  text("Saúde", MARGIN + 54, y - 33, 7, bold);
  text("Ministério", MARGIN + 90, y - 15, 7, regular);
  text("da", MARGIN + 90, y - 24, 7, regular);
  text("Saúde", MARGIN + 90, y - 33, 7, regular);
  const tx = MARGIN + 136;
  rect(tx, y - HH, W - 136, HH, 1);
  center("LAUDO PARA SOLICITAÇÃO/AUTORIZAÇÃO DE", tx + (W - 136) / 2, y - 21, 11.5, bold);
  center("PROCEDIMENTO AMBULATORIAL", tx + (W - 136) / 2, y - 36, 11.5, bold);
  text("fls. 1/1", PAGE_W - MARGIN - 34, y - 9, 7.5, italic);
  y -= HH + 4;

  const bar = (title: string) => {
    page.drawRectangle({ x: MARGIN, y: y - 13, width: W, height: 13, color: BAR });
    center(title, PAGE_W / 2, y - 9.5, 8, bold, WHITE);
    y -= 13;
  };

  /** Caixa numerada: rótulo pequeno em cima, valor em azul embaixo. Devolve o x seguinte. */
  const cell = (label: string, value: string, x: number, w: number, h: number) => {
    rect(x, y - h, w, h);
    text(label, x + 3, y - 7.5, 5.6, regular, MUTED);
    const v = safe(regular, value);
    if (v) {
      let size = 9.5;
      while (size > 6.2 && regular.widthOfTextAtSize(v, size) > w - 8) size -= 0.3;
      text(v, x + 4, y - h + 5, size, regular, FILL);
    }
    return x + w;
  };
  /** Caixa com um dígito por casinha (CNS, código SIGTAP). */
  const digitBoxes = (label: string, digits: string, count: number, x: number, w: number, h: number) => {
    rect(x, y - h, w, h);
    text(label, x + 3, y - 7.5, 5.6, regular, MUTED);
    const bw = (w - 8) / count;
    for (let i = 0; i < count; i++) {
      const bx = x + 4 + i * bw;
      page.drawRectangle({ x: bx, y: y - h + 3, width: bw, height: 11, borderColor: BORDER, borderWidth: 0.4 });
      const ch = digits[i];
      if (ch) text(ch, bx + bw / 2 - regular.widthOfTextAtSize(ch, 8.5) / 2, y - h + 6, 8.5, regular, FILL);
    }
    return x + w;
  };
  const checkbox = (cx: number, cy: number, on: boolean, label: string) => {
    page.drawRectangle({ x: cx, y: cy, width: 8, height: 8, borderColor: BORDER, borderWidth: 0.6 });
    if (on) text("X", cx + 1.4, cy + 1.2, 7.5, bold, FILL);
    text(label, cx + 11, cy + 1.2, 6.5, regular, BLACK);
  };
  const widths = (shares: number[]) => shares.map((s) => (W * s) / shares.reduce((p, c) => p + c, 0));

  // 1-2 Estabelecimento solicitante
  bar("IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE (SOLICITANTE)");
  {
    const [w1, w2] = widths([4.4, 1]);
    let x = cell("1 - NOME DO ESTABELECIMENTO DE SAÚDE SOLICITANTE", ESTABELECIMENTO, MARGIN, w1, 25);
    cell("2 - CNES", CNES, x, w2, 25);
    y -= 25;
  }

  // 3-17 Paciente
  bar("IDENTIFICAÇÃO DO PACIENTE");
  {
    const [w3, w4, w5] = widths([4, 1, 1.5]);
    let x = cell("3 - NOME DO PACIENTE", input.patient.name.toUpperCase(), MARGIN, w3, 26);
    rect(x, y - 26, w4, 26);
    text("4 - SEXO", x + 3, y - 7.5, 5.6, regular, MUTED);
    checkbox(x + 5, y - 22, a.sex === "Masculino", "Mas.");
    checkbox(x + 5 + w4 / 2, y - 22, a.sex === "Feminino", "Fem.");
    x += w4;
    cell("5 - Nº DO PRONTUÁRIO", of.prontuario, x, w5, 26);
    y -= 26;
  }
  {
    const [w6, w7, w8, w81] = widths([3.1, 1.2, 1.2, 1.2]);
    let x = digitBoxes("6 - CARTÃO NACIONAL DE SAÚDE (CNS)", a.cns.replace(/\D/g, ""), 15, MARGIN, w6, 26);
    x = cell("7 - DATA DE NASCIMENTO", dmy(input.patient.birthDate), x, w7, 26);
    x = cell("8 - RAÇA/COR", of.racaCor, x, w8, 26);
    cell("8.1 - ETNIA", of.etnia, x, w81, 26);
    y -= 26;
  }
  const phoneCell = (n: number, value: string, x: number, w: number) => {
    const { ddd, num } = splitPhone(value);
    rect(x, y - 26, w, 26);
    text(`${n} - TELEFONE DE CONTATO`, x + 3, y - 7.5, 5.6, regular, MUTED);
    text("DDD", x + 3, y - 15.5, 5.2, regular, MUTED);
    text(ddd, x + 4, y - 23, 9, regular, FILL);
    page.drawLine({ start: { x: x + 24, y: y - 26 }, end: { x: x + 24, y: y - 11 }, thickness: 0.4, color: BORDER });
    text("Nº DO TELEFONE", x + 27, y - 15.5, 5.2, regular, MUTED);
    text(num, x + 28, y - 23, 9, regular, FILL);
  };
  {
    const [w9, w10] = widths([4, 1.6]);
    const x = cell("9 - NOME DA MÃE", a.motherName, MARGIN, w9, 26);
    phoneCell(10, of.telefone || a.phone || "", x, w10);
    y -= 26;
  }
  {
    const [w11, w12] = widths([4, 1.6]);
    const x = cell("11 - NOME DO RESPONSÁVEL", of.responsavel, MARGIN, w11, 26);
    phoneCell(12, of.telResponsavel, x, w12);
    y -= 26;
  }
  cell("13 - ENDEREÇO (RUA, Nº, BAIRRO)", a.address, MARGIN, W, 24);
  y -= 24;
  {
    const [w14, w15, w16, w17] = widths([3.6, 1.4, 0.8, 1.4]);
    let x = cell("14 - MUNICÍPIO DE RESIDÊNCIA", of.municipality.toUpperCase() + (of.uf ? ` - ${of.uf.toUpperCase()}` : ""), MARGIN, w14, 26);
    x = cell("15 - CÓD. IBGE MUNICÍPIO", of.ibge, x, w15, 26);
    x = cell("16 - UF", of.uf.toUpperCase(), x, w16, 26);
    cell("17 - CEP", a.cep.replace(/\D/g, ""), x, w17, 26);
    y -= 26;
  }

  // 18-20 Procedimento solicitado
  bar("PROCEDIMENTO SOLICITADO");
  const proc = input.items[0];
  {
    const [wc, wn, wq] = widths([2.6, 4.2, 0.9]);
    let x = digitBoxes("18 - CÓDIGO DO PROCEDIMENTO PRINCIPAL", of.procCode.replace(/\D/g, ""), 10, MARGIN, wc, 26);
    x = cell("19 - NOME DO PROCEDIMENTO PRINCIPAL", proc?.name ?? "", x, wn, 26);
    cell("20 - QTDE", proc?.quantity?.trim() || "1", x, wq, 26);
    y -= 26;
  }

  // 21-35 Procedimentos secundários (5 linhas)
  bar("PROCEDIMENTO(S) SECUNDÁRIO(S)");
  for (let i = 0; i < 5; i++) {
    const s = of.secundarios[i];
    const [wc, wn, wq] = widths([2.6, 4.2, 0.9]);
    const n = 21 + i * 3;
    let x = digitBoxes(`${n} - CÓDIGO DO PROCEDIMENTO SECUNDÁRIO`, (s?.code ?? "").replace(/\D/g, ""), 10, MARGIN, wc, 24);
    x = cell(`${n + 1} - NOME DO PROCEDIMENTO SECUNDÁRIO`, s?.name ?? "", x, wn, 24);
    cell(`${n + 2} - QTDE`, s ? s.qty || "1" : "", x, wq, 24);
    y -= 24;
  }

  // 36-40 Justificativa
  bar("JUSTIFICATIVA DO(S) PROCEDIMENTO(S) SOLICITADO(S)");
  {
    const [w36, w37, w38, w39] = widths([4.0, 1.1, 1.2, 1.4]);
    let x = cell("36 - DESCRIÇÃO DO DIAGNÓSTICO", of.diagnostico, MARGIN, w36, 26);
    x = cell("37 - CID10 PRINCIPAL", a.cid, x, w37, 26);
    x = cell("38 - CID10 SECUNDÁRIO", a.cid2, x, w38, 26);
    cell("39 - CID10 CAUSAS ASSOC.", of.cid3, x, w39, 26);
    y -= 26;
  }
  {
    const oh = 78;
    rect(MARGIN, y - oh, W, oh);
    text("40 - OBSERVAÇÕES", MARGIN + 3, y - 7.5, 5.6, regular, MUTED);
    wrap(regular, input.notes ?? "", 9, W - 10)
      .slice(0, 6)
      .forEach((l, i) => text(l, MARGIN + 5, y - 19 - i * 11.2, 9, regular, FILL));
    y -= oh;
  }

  // 41-45 Solicitação
  bar("SOLICITAÇÃO");
  const issued = formatIssued(input.issuedAt);
  const registro = `CRM ${input.doctor.crm}/${input.doctor.crmUf.toUpperCase()}`;
  const docRaw = (of.solicitanteDoc || input.doctor.cpf || "").replace(/\D/g, "");
  const docIsCns = docRaw.length === 15;
  {
    const wl = W * 0.64;
    const wr = W - wl;
    const [w41, w42] = [wl * 0.68, wl * 0.32];
    let x = cell("41 - NOME DO PROFISSIONAL SOLICITANTE", `${input.doctor.name.toUpperCase()}`, MARGIN, w41, 25);
    cell("42 - DATA DA SOLICITAÇÃO", issued.slice(0, 10), x, w42, 25);
    y -= 25;
    // 43/44 documento do solicitante (segunda linha)
    rect(MARGIN, y - 25, wl * 0.32, 25);
    text("43 - DOCUMENTO", MARGIN + 3, y - 7.5, 5.6, regular, MUTED);
    checkbox(MARGIN + 5, y - 20, docIsCns, "CNS");
    checkbox(MARGIN + 5 + wl * 0.15, y - 20, !!docRaw && !docIsCns, "CPF");
    cell("44 - Nº DOCUMENTO DO SOLICITANTE", docIsCns ? docRaw : formatCpf(docRaw), MARGIN + wl * 0.32, wl * 0.68, 25);
    y += 25;
    // 45 assinatura e carimbo
    const sx = MARGIN + wl;
    rect(sx, y - 50, wr, 50);
    text("45 - ASSINATURA E CARIMBO (Nº REGISTRO DO CONSELHO)", sx + 3, y - 7.5, 5.6, regular, MUTED);
    wrap(bold, `${input.doctor.name.toUpperCase()} · ${registro}`, 8.5, wr - 10)
      .slice(0, 2)
      .forEach((l, i) => text(l, sx + 5, y - 22 - i * 10.5, 8.5, bold, FILL));
    wrap(regular, opts.preview ? "Pré-visualização (ainda sem assinatura digital)" : `Assinado digitalmente em ${issued}`, 6.8, wr - 10)
      .slice(0, 2)
      .forEach((l, i) => text(l, sx + 5, y - 38 - i * 8.5, 6.8, regular, opts.preview ? MUTED : FILL));
    y -= 50;
  }

  // 46-53 Autorização (em branco: preenchida pela regulação)
  bar("AUTORIZAÇÃO");
  {
    const [wa, wb, wc2] = widths([3.6, 1.6, 2.2]);
    let x = cell("46 - NOME DO PROFISSIONAL AUTORIZADOR", "", MARGIN, wa, 23);
    x = cell("47 - CÓD. ÓRGÃO EMISSOR", "", x, wb, 23);
    cell("52 - Nº DA AUTORIZAÇÃO (APAC)", "", x, wc2, 23);
    y -= 23;
  }
  {
    const [wa, wb, wc2] = widths([3.6, 1.6, 2.2]);
    let x = cell("48/49 - DOCUMENTO (CNS/CPF) Nº DO PROFISSIONAL AUTORIZADOR", "", MARGIN, wa, 23);
    x = cell("50 - DATA DA AUTORIZAÇÃO", "", x, wb, 23);
    cell("53 - PERÍODO DE VALIDADE DA APAC", "      /      /            a            /      /", x, wc2, 23);
    y -= 23;
  }
  cell("51 - ASSINATURA E CARIMBO (Nº DO REGISTRO DO CONSELHO)", "", MARGIN, W, 23);
  y -= 23;

  // 54-55 Estabelecimento executante (em branco)
  bar("IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE (EXECUTANTE)");
  {
    const [w54, w55] = widths([4.4, 1]);
    const x = cell("54 - NOME FANTASIA DO ESTABELECIMENTO DE SAÚDE EXECUTANTE", "", MARGIN, w54, 23);
    cell("55 - CNES", "", x, w55, 23);
    y -= 23;
  }

  // Rodapé: identificação da assinatura digital (igual receita/exames).
  const top = y - 8;
  const t2 = (t: string, xx: number, yy: number, size: number, font = regular, color = INK) =>
    page.drawText(safe(font, t), { x: xx, y: yy, size, font, color });
  page.drawLine({ start: { x: MARGIN, y: top }, end: { x: PAGE_W - MARGIN, y: top }, thickness: 0.8, color: LINE });
  if (opts.preview) {
    t2("Pré-visualização — documento ainda sem assinatura digital", MARGIN, top - 12, 8.5, bold);
    t2("A assinatura ICP-Brasil é aplicada ao emitir o laudo.", MARGIN, top - 23, 7.5, regular, MUTED);
  } else {
    t2("Documento assinado digitalmente", MARGIN, top - 12, 8.5, bold);
    t2(`${input.doctor.name.toUpperCase()} · ${registro} · certificado ICP-Brasil · emitido em ${issued}`, MARGIN, top - 23, 7.5, regular, MUTED);
    t2("Documento emitido em modalidade de telemedicina (Resolução CFM nº 2.314/2022) · confira a assinatura em validar.iti.gov.br", MARGIN, top - 34, 7.5, regular, MUTED);
  }
  return pdf.save();
}
