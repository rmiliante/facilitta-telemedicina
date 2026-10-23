import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { PrescriptionPdfInput } from "@/lib/prescriptionPdf";
import { ENMG_BRASAO_BASE64 } from "@/lib/enmgBrasao";
import {
  IMAGEM_CONTRASTE_LABEL,
  IMAGEM_SAFETY_LABEL,
  IMAGEM_SAFETY_ROWS,
  IMAGEM_TIPO_LABEL,
  imagemUsaContraste,
} from "@/lib/imagemForm";

/**
 * Solicitação de ressonância / tomografia / cintilografia: mesmo estilo do formulário
 * da ENMG (campos preenchidos em azul, assinatura em linha única, rodapé ICP-Brasil).
 */

const ESTABELECIMENTO = process.env.APAC_ESTABELECIMENTO || "Polo Integrado de Saúde de Jacobina - Ba";
const CNES = process.env.APAC_CNES || "6117252";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 50;
const FILL = rgb(0x0b / 255, 0x3d / 255, 0x91 / 255);
const BLACK = rgb(0, 0, 0);
const MUTED = rgb(0.29, 0.27, 0.38);
const LINE = rgb(0.84, 0.82, 0.78);
const INK = rgb(0.11, 0.09, 0.19);

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

function formatCns(cns: string) {
  const d = cns.replace(/\D/g, "");
  return d.length === 15 ? d.replace(/(\d{3})(\d{4})(\d{4})(\d{4})/, "$1 $2 $3 $4") : cns;
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

export async function buildImagemPdf(input: PrescriptionPdfInput, opts: { preview?: boolean } = {}): Promise<Uint8Array> {
  const a = input.apac!;
  const im = a.imagem!;
  const pdf = await PDFDocument.create();
  const tipoLabel = IMAGEM_TIPO_LABEL[im.tipo];
  pdf.setTitle(`Solicitação de ${tipoLabel.toLowerCase()} - ${input.patient.name}`);
  pdf.setAuthor(input.doctor.name);
  pdf.setCreator("Receituário digital");
  pdf.setProducer("Receituário digital");
  pdf.setLanguage("pt-BR");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const SZ = 10;
  const inner = PAGE_W - MARGIN * 2;
  let y = PAGE_H - 40; // baseline corrente (de cima pra baixo)

  const text = (t: string, x: number, yy: number, size = SZ, font = regular, color = BLACK) =>
    page.drawText(safe(font, t), { x, y: yy, size, font, color });
  const center = (t: string, cx: number, yy: number, size: number, font: PDFFont, color = BLACK) => {
    const s = safe(font, t);
    page.drawText(s, { x: cx - font.widthOfTextAtSize(s, size) / 2, y: yy, size, font, color });
  };
  const hline = (x1: number, x2: number, yy: number, thickness = 0.6, color = BLACK) =>
    page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness, color });

  // Cabeçalho
  page.drawImage(await pdf.embedPng(Buffer.from(ENMG_BRASAO_BASE64, "base64")), { x: MARGIN, y: PAGE_H - 40 - 62, width: 62, height: 62 });
  ["Secretaria Municipal de Saúde", "Diretoria Regulação, Controle e Avaliação", "Coordenadoria Municipal de Regulação Ambulatorial e Hospitalar"].forEach((t, i) =>
    center(t, PAGE_W / 2 + 25, y - 14 - i * 14, 10, italic),
  );
  y -= 80;
  center("SOLICITAÇÃO DE EXAME DE ALTA COMPLEXIDADE", PAGE_W / 2, y, 12, bold);
  center(tipoLabel.toUpperCase(), PAGE_W / 2, y - 16, 11, bold, FILL);
  y -= 38;

  /** Rótulo em preto + valor em azul sobre a linha de preencher. Devolve o x final. */
  const field = (label: string, value: string, x: number, yy: number, xEnd: number) => {
    text(label, x, yy, SZ, regular);
    const vx = x + regular.widthOfTextAtSize(safe(regular, label), SZ) + 4;
    let size = SZ;
    while (size > 6.5 && regular.widthOfTextAtSize(safe(regular, value), size) > xEnd - vx - 4) size -= 0.3;
    if (value) text(value, vx + 2, yy, size, regular, FILL);
    hline(vx, xEnd, yy - 2);
    return xEnd;
  };
  /** Texto longo em azul, quebrado em linhas (mínimo de linhas sublinhadas). */
  const paragraph = (value: string, yy: number, minLines: number, maxLines: number) => {
    const lines = wrap(regular, value, SZ, inner - 6).slice(0, maxLines);
    const n = Math.max(minLines, lines.length);
    for (let i = 0; i < n; i++) {
      const ly = yy - i * 15;
      if (lines[i]) text(lines[i], MARGIN + 3, ly, SZ, regular, FILL);
      hline(MARGIN, PAGE_W - MARGIN, ly - 2);
    }
    return yy - n * 15;
  };
  const heading = (t: string, yy: number) => text(t, MARGIN, yy, SZ, bold);
  const box = (x: number, yy: number, label: string, on: boolean) => {
    page.drawRectangle({ x, y: yy - 1, width: 9, height: 9, borderColor: BLACK, borderWidth: 0.7 });
    if (on) {
      text("X", x + 1.6, yy, 8, bold, FILL);
    }
    text(label, x + 14, yy, SZ, regular);
  };

  // I. Estabelecimento
  heading("I.  IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE (SOLICITANTE):", y);
  y -= 22;
  field("NOME DO ESTABELECIMENTO: ", ESTABELECIMENTO, MARGIN, y, MARGIN + 360);
  field("CNES: ", CNES, MARGIN + 372, y, PAGE_W - MARGIN);
  y -= 26;

  // II. Paciente
  heading("II.  IDENTIFICAÇÃO DO PACIENTE:", y);
  y -= 22;
  field("NOME DO PACIENTE: ", input.patient.name, MARGIN, y, PAGE_W - MARGIN);
  y -= 22;
  field("DATA DE NASCIMENTO: ", dmy(input.patient.birthDate), MARGIN, y, MARGIN + 190);
  field("SEXO: ", a.sex.toUpperCase(), MARGIN + 205, y, MARGIN + 320);
  field("CNS: ", formatCns(a.cns), MARGIN + 335, y, PAGE_W - MARGIN);
  y -= 22;
  field("ENDEREÇO: ", a.address, MARGIN, y, PAGE_W - MARGIN);
  y -= 22;
  field("MUNICÍPIO: ", im.municipality, MARGIN, y, MARGIN + 250);
  field("TELEFONE: ", im.phoneMobile, MARGIN + 265, y, PAGE_W - MARGIN);
  y -= 26;

  // III. Exame
  heading("III.  EXAME SOLICITADO:", y);
  y -= 22;
  field("TIPO: ", tipoLabel.toUpperCase(), MARGIN, y, MARGIN + 270);
  const regiao = im.regiao === "Outro" ? im.detalhe.trim() || "Outro" : im.regiao;
  field("REGIÃO / ESTUDO: ", regiao, MARGIN + 285, y, PAGE_W - MARGIN);
  y -= 22;
  if (imagemUsaContraste(im.tipo)) {
    text("CONTRASTE:", MARGIN, y);
    let cx = MARGIN + 70;
    (["sem", "com", "sem_com"] as const).forEach((k) => {
      box(cx, y, IMAGEM_CONTRASTE_LABEL[k], im.contraste === k);
      cx += 14 + regular.widthOfTextAtSize(IMAGEM_CONTRASTE_LABEL[k], SZ) + 20;
    });
    y -= 22;
  }
  if (im.detalhe.trim() && im.regiao !== "Outro") {
    field("DETALHE: ", im.detalhe.trim(), MARGIN, y, PAGE_W - MARGIN);
    y -= 22;
  }
  y -= 6;

  // IV. História clínica
  heading("IV.  RESUMO DA HISTÓRIA CLÍNICA:", y);
  y -= 22;
  y = paragraph(input.notes ?? "", y, 3, 7);
  y -= 8;
  field("CID-10: ", a.cid, MARGIN, y - 12, MARGIN + 160);
  y -= 38;

  // V. Hipótese e segurança
  heading("V.  HIPÓTESE(S) DIAGNÓSTICA(S) QUE MOTIVA(M) A SOLICITAÇÃO:", y);
  y -= 22;
  y = paragraph(im.hypotheses, y, 2, 4);
  y -= 12;
  heading("VI.  INFORMAÇÕES DE SEGURANÇA DO EXAME:", y);
  y -= 22;
  IMAGEM_SAFETY_ROWS.forEach((row) => {
    let cx = MARGIN;
    row.forEach((id) => {
      box(cx, y, IMAGEM_SAFETY_LABEL[id], im.safety.includes(id));
      cx += 175;
    });
    y -= 16;
  });
  y -= 8;

  // Data e assinatura (linha única)
  const issued = formatIssued(input.issuedAt);
  center(`DATA DA SOLICITAÇÃO: ${issued.slice(0, 10)}`, PAGE_W / 2, y, SZ, regular);
  y -= 40;
  const registro = `CRM ${input.doctor.crm}/${input.doctor.crmUf.toUpperCase()}`;
  hline(PAGE_W / 2 - 150, PAGE_W / 2 + 150, y, 0.7);
  center(`${input.doctor.name.toUpperCase()} · ${registro}`, PAGE_W / 2, y - 14, 10.5, bold, FILL);
  center(
    opts.preview ? "Pré-visualização (ainda sem assinatura digital)" : `Assinado digitalmente em ${issued}`,
    PAGE_W / 2,
    y - 28,
    8.5,
    regular,
    opts.preview ? MUTED : FILL,
  );

  // Rodapé: identificação da assinatura digital (igual receita/exames).
  const top = 122;
  const t2 = (t: string, xx: number, yy: number, size: number, font = regular, color = INK) =>
    page.drawText(safe(font, t), { x: xx, y: yy, size, font, color });
  page.drawLine({ start: { x: MARGIN, y: top }, end: { x: PAGE_W - MARGIN, y: top }, thickness: 0.8, color: LINE });
  if (opts.preview) {
    t2("Pré-visualização — documento ainda sem assinatura digital", MARGIN, top - 20, 10, bold);
    t2("A assinatura ICP-Brasil é aplicada ao emitir a solicitação.", MARGIN, top - 35, 8.5, regular, MUTED);
  } else {
    t2("Documento assinado digitalmente", MARGIN, top - 20, 10, bold);
    t2(`${input.doctor.name.toUpperCase()} · ${registro} · certificado ICP-Brasil`, MARGIN, top - 35, 8.5, regular, MUTED);
    t2(`Emitido em ${issued}`, MARGIN, top - 48, 8.5, regular, MUTED);
    t2("Documento emitido em modalidade de telemedicina (Resolução CFM nº 2.314/2022)", MARGIN, top - 61, 8.5, regular, MUTED);
    t2("Confira a autenticidade da assinatura em validar.iti.gov.br", MARGIN, top - 74, 8.5, regular, MUTED);
    const place = [input.patient.city, input.patient.state].filter(Boolean).join("/");
    const right = place ? `${place}, ${issued.slice(0, 10)}` : issued.slice(0, 10);
    const r = safe(regular, right);
    t2(r, PAGE_W - MARGIN - regular.widthOfTextAtSize(r, 9), top - 74, 9, regular, MUTED);
  }
  return pdf.save();
}
