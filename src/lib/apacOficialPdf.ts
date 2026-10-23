import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { PrescriptionPdfInput } from "@/lib/prescriptionPdf";
import { ENMG_BRASAO_BASE64 } from "@/lib/enmgBrasao";
import { formatSigtap } from "@/lib/apacOficial";

/**
 * Laudo para Solicitação/Autorização de Procedimento Ambulatorial (APAC), no modelo do
 * Ministério da Saúde: campos numerados em caixas, bloco do autorizador em branco.
 */

const ESTABELECIMENTO = process.env.APAC_ESTABELECIMENTO || "Polo Integrado de Saúde de Jacobina - Ba";
const CNES = process.env.APAC_CNES || "6117252";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 36;
const FILL = rgb(0x0b / 255, 0x3d / 255, 0x91 / 255);
const BLACK = rgb(0, 0, 0);
const MUTED = rgb(0.29, 0.27, 0.38);
const LINE = rgb(0.84, 0.82, 0.78);
const INK = rgb(0.11, 0.09, 0.19);
const GRAY = rgb(0.9, 0.9, 0.9);
const BORDER = rgb(0.25, 0.25, 0.25);

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

export async function buildApacOficialPdf(input: PrescriptionPdfInput, opts: { preview?: boolean } = {}): Promise<Uint8Array> {
  const a = input.apac!;
  const of = a.oficial!;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Laudo para solicitação de APAC - ${input.patient.name}`);
  pdf.setAuthor(input.doctor.name);
  pdf.setCreator("Receituário digital");
  pdf.setProducer("Receituário digital");
  pdf.setLanguage("pt-BR");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const page = pdf.addPage([PAGE_W, PAGE_H]);
  const W = PAGE_W - MARGIN * 2;
  const ROW = 26;

  const center = (t: string, cx: number, yy: number, size: number, font: PDFFont, color = BLACK) => {
    const s = safe(font, t);
    page.drawText(s, { x: cx - font.widthOfTextAtSize(s, size) / 2, y: yy, size, font, color });
  };
  const text = (t: string, x: number, yy: number, size: number, font = regular, color = BLACK) =>
    page.drawText(safe(font, t), { x, y: yy, size, font, color });

  // Cabeçalho
  let y = PAGE_H - 30;
  page.drawImage(await pdf.embedPng(Buffer.from(ENMG_BRASAO_BASE64, "base64")), { x: MARGIN, y: y - 46, width: 46, height: 46 });
  center("SUS - Sistema Único de Saúde", PAGE_W / 2 + 20, y - 10, 10, italic);
  center("LAUDO PARA SOLICITAÇÃO / AUTORIZAÇÃO DE PROCEDIMENTO AMBULATORIAL", PAGE_W / 2 + 20, y - 27, 11, bold);
  center("APAC", PAGE_W / 2 + 20, y - 42, 10, bold, FILL);
  y -= 58;

  const bar = (title: string) => {
    page.drawRectangle({ x: MARGIN, y: y - 13, width: W, height: 13, color: GRAY, borderColor: BORDER, borderWidth: 0.5 });
    text(title, MARGIN + 4, y - 10, 7.5, bold);
    y -= 13;
  };
  /** Caixa numerada: rótulo pequeno em cima, valor em azul embaixo. Devolve o x seguinte. */
  const cell = (n: number, label: string, value: string, x: number, w: number, h = ROW, blank = false) => {
    page.drawRectangle({ x, y: y - h, width: w, height: h, borderColor: BORDER, borderWidth: 0.5 });
    text(`${n} - ${label}`, x + 3, y - 8, 6.3, regular, MUTED);
    const v = safe(regular, value);
    if (v) {
      let size = 9.5;
      while (size > 6.5 && regular.widthOfTextAtSize(v, size) > w - 8) size -= 0.3;
      text(v, x + 4, y - h + 6, size, regular, FILL);
    }
    return x + w;
  };
  const row = (cells: [number, string, string, number][], h = ROW, blank = false) => {
    const total = cells.reduce((s, c) => s + c[3], 0);
    let x = MARGIN;
    for (const [n, label, value, share] of cells) x = cell(n, label, value, x, (W * share) / total, h, blank);
    y -= h;
  };

  // Estabelecimento solicitante
  bar("IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE (SOLICITANTE)");
  row([
    [1, "NOME DO ESTABELECIMENTO DE SAÚDE SOLICITANTE", ESTABELECIMENTO, 4],
    [2, "CNES", CNES, 1],
  ]);

  // Paciente
  bar("IDENTIFICAÇÃO DO PACIENTE");
  row([
    [3, "NOME DO PACIENTE", input.patient.name.toUpperCase(), 4],
    [4, "Nº DO PRONTUÁRIO", of.prontuario, 1.3],
  ]);
  row([
    [5, "CARTÃO NACIONAL DE SAÚDE (CNS)", formatCns(a.cns), 2.2],
    [6, "DATA DE NASCIMENTO", dmy(input.patient.birthDate), 1.4],
    [7, "SEXO", a.sex, 1.2],
    [8, "RAÇA / COR", of.racaCor, 1.4],
  ]);
  row([
    [9, "NOME DA MÃE", a.motherName, 3],
    [10, "TELEFONE DE CONTATO", of.telefone || a.phone || "", 1.4],
  ]);
  row([
    [11, "NOME DO RESPONSÁVEL", of.responsavel, 3],
    [12, "TELEFONE DE CONTATO", of.telResponsavel, 1.4],
  ]);
  row([[13, "ENDEREÇO (RUA, Nº, BAIRRO)", a.address, 1]]);
  row([
    [14, "MUNICÍPIO DE RESIDÊNCIA", of.municipality, 3],
    [15, "CÓD. IBGE MUNICÍPIO", of.ibge, 1.3],
    [16, "UF", of.uf.toUpperCase(), 0.7],
    [17, "CEP", a.cep, 1.2],
  ]);

  // Procedimento
  bar("PROCEDIMENTO SOLICITADO");
  const proc = input.items[0];
  row([
    [18, "CÓDIGO DO PROCEDIMENTO (SIGTAP)", of.procCode ? formatSigtap(of.procCode) : "", 1.6],
    [19, "NOME DO PROCEDIMENTO", proc?.name ?? "", 4],
    [20, "QTDE.", proc?.quantity?.trim() || "1", 0.6],
  ]);

  // Justificativa
  bar("JUSTIFICATIVA DO(S) PROCEDIMENTO(S) SOLICITADO(S)");
  const jh = 92;
  page.drawRectangle({ x: MARGIN, y: y - jh, width: W, height: jh, borderColor: BORDER, borderWidth: 0.5 });
  text("21 - DESCRIÇÃO DO DIAGNÓSTICO / QUADRO CLÍNICO", MARGIN + 3, y - 8, 6.3, regular, MUTED);
  wrap(regular, input.notes ?? "", 9, W - 10)
    .slice(0, 7)
    .forEach((l, i) => text(l, MARGIN + 5, y - 21 - i * 11.5, 9, regular, FILL));
  y -= jh;
  row([
    [22, "CID-10 PRINCIPAL", a.cid, 1],
    [23, "CID-10 SECUNDÁRIO", a.cid2, 1],
    [24, "CID-10 CAUSAS ASSOCIADAS", of.cid3, 1],
  ]);

  // Solicitante
  bar("SOLICITAÇÃO");
  const issued = formatIssued(input.issuedAt);
  const registro = `CRM ${input.doctor.crm}/${input.doctor.crmUf.toUpperCase()}`;
  row([
    [25, "NOME DO PROFISSIONAL SOLICITANTE", `${input.doctor.name.toUpperCase()} · ${registro}`, 3.2],
    [26, "DATA DA SOLICITAÇÃO", issued.slice(0, 10), 1.2],
    [27, "CNS / CPF DO SOLICITANTE", of.solicitanteDoc, 1.8],
  ]);
  const sh = 46;
  page.drawRectangle({ x: MARGIN, y: y - sh, width: W, height: sh, borderColor: BORDER, borderWidth: 0.5 });
  text("28 - ASSINATURA E CARIMBO DO PROFISSIONAL SOLICITANTE", MARGIN + 3, y - 8, 6.3, regular, MUTED);
  center(`${input.doctor.name.toUpperCase()} · ${registro}`, PAGE_W / 2, y - 24, 10, bold, FILL);
  center(
    opts.preview ? "Pré-visualização (ainda sem assinatura digital)" : `Assinado digitalmente em ${issued}`,
    PAGE_W / 2,
    y - 37,
    8,
    regular,
    opts.preview ? MUTED : FILL,
  );
  y -= sh;

  // Autorizador (em branco: preenchido pela regulação)
  bar("AUTORIZAÇÃO (PREENCHIMENTO PELO ÓRGÃO AUTORIZADOR)");
  row(
    [
      [29, "NOME DO PROFISSIONAL AUTORIZADOR", "", 3],
      [30, "CÓD. ÓRGÃO EMISSOR", "", 1.4],
      [31, "DOCUMENTO (CNS / CPF) Nº", "", 1.8],
    ],
    ROW,
    true,
  );
  row(
    [
      [32, "DATA DA AUTORIZAÇÃO", "", 1.3],
      [33, "Nº DA AUTORIZAÇÃO (APAC)", "", 2],
      [34, "VALIDADE DA APAC", "____/____/______  a  ____/____/______", 2.2],
    ],
    ROW,
    true,
  );
  row([[35, "ESTABELECIMENTO EXECUTANTE (NOME E CNES)", "", 1]], ROW, true);

  // Rodapé: identificação da assinatura digital (igual receita/exames).
  const top = 100;
  const t2 = (t: string, xx: number, yy: number, size: number, font = regular, color = INK) =>
    page.drawText(safe(font, t), { x: xx, y: yy, size, font, color });
  page.drawLine({ start: { x: MARGIN, y: top }, end: { x: PAGE_W - MARGIN, y: top }, thickness: 0.8, color: LINE });
  if (opts.preview) {
    t2("Pré-visualização — documento ainda sem assinatura digital", MARGIN, top - 16, 9.5, bold);
    t2("A assinatura ICP-Brasil é aplicada ao emitir o laudo.", MARGIN, top - 29, 8, regular, MUTED);
  } else {
    t2("Documento assinado digitalmente", MARGIN, top - 16, 9.5, bold);
    t2(`${input.doctor.name.toUpperCase()} · ${registro} · certificado ICP-Brasil`, MARGIN, top - 29, 8, regular, MUTED);
    t2(`Emitido em ${issued}`, MARGIN, top - 41, 8, regular, MUTED);
    t2("Documento emitido em modalidade de telemedicina (Resolução CFM nº 2.314/2022)", MARGIN, top - 53, 8, regular, MUTED);
    t2("Confira a autenticidade da assinatura em validar.iti.gov.br", MARGIN, top - 65, 8, regular, MUTED);
  }
  return pdf.save();
}
