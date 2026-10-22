import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { PrescriptionPdfInput } from "@/lib/prescriptionPdf";
import { ENMG_BRASAO_BASE64 } from "@/lib/enmgBrasao";
import { ENMG_COMORB_LABEL, ENMG_COMORB_ROWS, ENMG_PROC_LABEL, ENMG_PROC_ROWS } from "@/lib/enmgForm";

/**
 * Formulário para solicitação de eletroneuromiografia (Secretaria Municipal
 * de Saúde), igual ao papel: campos preenchidos em azul, assinatura digital
 * da médica na linha do solicitante e rodapé de assinatura ICP-Brasil.
 * O layout é desenhado em "pixels de projeto" (folha de 794 x 1123) e
 * convertido pra pontos.
 */

// Estabelecimento solicitante (fixo, interno). Pode ser trocado pelas variáveis de ambiente.
const ESTABELECIMENTO = process.env.APAC_ESTABELECIMENTO || "Facilitta Saúde";
const CNES = process.env.APAC_CNES || "";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const SCALE = 0.86; // encolhe o conteúdo pra caber o rodapé de assinatura
const PT = 0.75; // pixel -> ponto
const CX = 397;
const FS = 14.5 * SCALE * PT; // corpo
const FILL = rgb(0x0b / 255, 0x3d / 255, 0x91 / 255);
const BLACK = rgb(0, 0, 0);
const MUTED = rgb(0.29, 0.27, 0.38);
const LINE = rgb(0.84, 0.82, 0.78);
const INK = rgb(0.11, 0.09, 0.19);

const X = (px: number) => (CX + (px - CX) * SCALE) * PT;
const Y = (top: number) => PAGE_H - top * SCALE * PT;
const W = (px: number) => px * SCALE * PT;

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

function wrapLines(font: PDFFont, text: string, size: number, maxPt: number): string[] {
  const words = safe(font, text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(cand, size) <= maxPt) line = cand;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function dmy(iso?: string | null): [string, string, string] {
  const [y, m, d] = (iso ?? "").slice(0, 10).split("-");
  return y && m && d ? [d, m, y] : ["", "", ""];
}

function splitPhone(raw?: string | null): [string, string] {
  const d = (raw ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length >= 10) {
    const rest = d.slice(2);
    const num = rest.length === 9 ? `${rest.slice(0, 5)}-${rest.slice(5)}` : `${rest.slice(0, 4)}-${rest.slice(4)}`;
    return [d.slice(0, 2), num];
  }
  return ["", d];
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

export async function buildEnmgPdf(input: PrescriptionPdfInput, opts: { preview?: boolean } = {}): Promise<Uint8Array> {
  const a = input.apac!;
  const e = a.enmg!;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Solicitação de eletroneuromiografia - ${input.patient.name}`);
  pdf.setAuthor(input.doctor.name);
  pdf.setCreator("Receituário digital");
  pdf.setProducer("Receituário digital");
  pdf.setLanguage("pt-BR");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);

  const draw = (t: string, xPx: number, top: number, font = regular, size = FS, color = BLACK) => {
    const s = safe(font, t).trimEnd();
    page.drawText(s, { x: X(xPx), y: Y(top + 13), size, font, color });
    return xPx + font.widthOfTextAtSize(s, size) / (SCALE * PT);
  };
  const widthPx = (t: string, font = regular, size = FS) => font.widthOfTextAtSize(safe(font, t), size) / (SCALE * PT);
  const underline = (x1: number, x2: number, top: number) =>
    page.drawLine({ start: { x: X(x1), y: Y(top + 16) }, end: { x: X(x2), y: Y(top + 16) }, thickness: 0.7, color: BLACK });
  /** Campo preenchido: valor em azul sobre a linha de preencher. */
  const field = (v: string, x0: number, w0: number, top: number, gap = 0) => {
    const x = x0 + gap;
    const w = w0 - gap;
    const fit = (() => {
      let size = FS;
      while (size > 6.5 && regular.widthOfTextAtSize(safe(regular, v), size) > W(w) - 4) size -= 0.3;
      return size;
    })();
    if (v) draw(v, x + 3, top, regular, fit, FILL);
    underline(x, x + w, top);
    return x + w;
  };
  const heading = (t: string, top: number) => draw(t, 96, top, bold);
  const check = (x: number, top: number, label: string, on: boolean) => {
    let cx = draw("(", x, top);
    const gap = widthPx("X", bold) + 2;
    if (on) draw("X", cx + 1, top, bold, FS, FILL);
    cx += gap + 1;
    cx = draw(")", cx, top);
    draw(` ${label}`, cx, top);
  };

  const checkW = (label: string) => widthPx("(") + widthPx("X", bold) + 3 + widthPx(")") + widthPx(` ${label}`);
  /** Linhas de caixinhas alinhadas em colunas (largura = o maior rótulo da coluna). */
  const checkGrid = (rows: string[][], labels: Record<string, string>, selected: string[], top0: number, step: number) => {
    const cols = Math.max(...rows.map((r) => r.length));
    const colX: number[] = [96];
    for (let c = 1; c < cols; c++) {
      const w = Math.max(...rows.map((r) => (r[c - 1] ? checkW(labels[r[c - 1]]) : 0)));
      colX[c] = colX[c - 1] + w + 24;
    }
    const common = Math.min(...rows.map((r) => r.length));
    rows.forEach((row, r) => {
      let prevEnd = 0;
      row.forEach((id, c) => {
        const xx = c < common ? colX[c] : prevEnd + 24;
        check(xx, top0 + r * step, labels[id], selected.includes(id));
        prevEnd = xx + checkW(labels[id]);
      });
    });
  };

  // Cabeçalho
  page.drawImage(await pdf.embedPng(Buffer.from(ENMG_BRASAO_BASE64, "base64")), {
    x: X(118),
    y: Y(36 + 92),
    width: W(92),
    height: W(92),
  });
  const hdr = ["Secretaria Municipal de Saúde", "Diretoria Regulação, Controle e Avaliação", "Coordenadoria Municipal de Regulação Ambulatorial e Hospitalar"];
  hdr.forEach((t, i) => {
    const s = safe(italic, t);
    const size = 13 * SCALE * PT;
    page.drawText(s, { x: X(492) - italic.widthOfTextAtSize(s, size) / 2, y: Y(54 + i * 17 + 12), size, font: italic, color: BLACK });
  });
  const title = "FORMULÁRIO PARA SOLICITAÇÃO DE ELETRONEUROMIOGRAFIA";
  page.drawText(title, { x: X(CX) - bold.widthOfTextAtSize(title, FS) / 2, y: Y(158 + 13), size: FS, font: bold, color: BLACK });

  // I. Estabelecimento
  heading("I.  IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE (SOLICITANTE):", 228);
  const lbl = "NOME DO ESTABELECIMENTO DE SAÚDE SOLICITANTE: ";
  let x = draw(lbl, 96, 262);
  const nameLines = wrapLines(regular, ESTABELECIMENTO, FS, W(622 - x) - 4);
  const first = nameLines[0] ?? "";
  field(first, x, 622 - x, 262, 5);
  field(nameLines.slice(1).join(" "), 96, 341, 288);
  x = draw(" CNES: ", 437, 288);
  field(CNES, x, 600 - x, 288, 5);

  // II. Paciente
  heading("II.  IDENTIFICAÇÃO DO PACIENTE:", 322);
  x = draw("NOME DO PACIENTE: ", 96, 352);
  field(input.patient.name, x, 570 - x, 352, 5);

  const [bd, bm, by] = dmy(input.patient.birthDate);
  x = draw("DATA DE NASCIMENTO: ", 96, 378);
  x = field(bd, x, 27, 378, 5);
  x = draw("/", x, 378);
  x = field(bm, x, 24, 378);
  x = draw("/", x, 378);
  x = field(by, x, 50, 378);
  x = draw("   SEXO: FEMININO (", x, 378);
  if (a.sex === "Feminino") draw("X", x + 1, 378, bold, FS, FILL);
  x = draw(" ) MASCULINO (", x + widthPx("X", bold) + 3, 378);
  if (a.sex === "Masculino") draw("X", x + 1, 378, bold, FS, FILL);
  draw(" )", x + widthPx("X", bold) + 3, 378);

  x = draw("ENDEREÇO: ", 96, 404);
  field([a.address, a.cep ? `CEP ${a.cep}` : ""].filter(Boolean).join(", "), x, 576 - x, 404, 5);

  x = draw("MUNICIPIO DE RESIDÊNCIA: ", 96, 430);
  x = field(e.municipality || [input.patient.city, input.patient.state].filter(Boolean).join("/"), x, 130, 430, 5);
  x = draw(" CNS: ", x, 430);
  field(formatCns(a.cns), x, 600 - x, 430, 5);

  const [hd, hn] = splitPhone(e.phoneHome);
  const [md, mn] = splitPhone(e.phoneMobile);
  x = draw("TELEFONE RESIDENCIAL: (", 96, 456);
  x = field(hd, x + 2, 18, 456);
  x = draw(")", x, 456);
  x = field(hn, x, 80, 456);
  x = draw(" TELEFONE CELULAR (", x, 456);
  x = field(md, x + 2, 20, 456);
  x = draw(" ) ", x, 456);
  field(mn, x, 698 - x, 456);

  // III. Procedimento
  heading("III. PROCEDIMENTO SOLICITADO:", 496);
  checkGrid(ENMG_PROC_ROWS, ENMG_PROC_LABEL, e.procedures, 532, 19);

  // IV. Resumo da história clínica
  heading("IV. RESUMO DA HISTÓRIA CLÍNICA:", 590);
  const freeText = (text: string, top0: number) => {
    let size = FS;
    let lines = wrapLines(regular, text, size, W(598) - 4);
    while (lines.length > 3 && size > 6.8) {
      size -= 0.3;
      lines = wrapLines(regular, text, size, W(598) - 4);
    }
    for (let i = 0; i < 3; i++) {
      const top = top0 + i * 26;
      if (lines[i]) draw(lines[i], 98, top, regular, size, FILL);
      underline(96, 698, top);
    }
  };
  freeText(input.notes ?? "", 622);
  const cid = [a.cid, a.cid2].filter(Boolean).join(", ");
  x = draw("CID:", 96, 700, bold);
  field(cid, x, 125, 700, 5);

  // V. Patologia concomitante
  heading("V. EXISTÊNCIA DE PATOLOGIA CONCOMITANTE:", 742);
  checkGrid(ENMG_COMORB_ROWS, ENMG_COMORB_LABEL, e.comorbidities, 790, 26);
  heading("HIPÓTESE(S) DIAGNÓSTICA(S) QUE MOTIVA(M) SOLICITAÇÃO DO EXAME:", 868);
  freeText(e.hypotheses, 898);

  // Data e assinatura
  const [dd, dm, dy] = formatIssued(input.issuedAt).slice(0, 10).split("/");
  const dateLabel = "DATA DA SOLICITAÇÃO: ";
  const total = widthPx(dateLabel.trimEnd(), regular) + 27 + widthPx("/") + 22 + widthPx("/") + 50;
  x = draw(dateLabel, CX - total / 2, 976);
  x = field(dd, x, 27, 976, 5);
  x = draw("/", x, 976);
  x = field(dm, x, 22, 976);
  x = draw("/", x, 976);
  field(dy, x, 50, 976);

  const registro = `CRM ${input.doctor.crm}/${input.doctor.crmUf.toUpperCase()}`;
  const issued = formatIssued(input.issuedAt);
  const small = 11 * SCALE * PT;
  const center = (t: string, cxPx: number, top: number, font: PDFFont, size: number, color = BLACK) => {
    const s = safe(font, t);
    page.drawText(s, { x: X(cxPx) - font.widthOfTextAtSize(s, size) / 2, y: Y(top + 13), size, font, color });
  };
  // selo de assinatura (ou aviso de pré-visualização)
  if (opts.preview) {
    center("PRÉ-VISUALIZAÇÃO", 215, 1008, bold, small, MUTED);
    center("(ainda sem assinatura digital)", 215, 1022, regular, small, MUTED);
  } else {
    const sx = X(112);
    const sy = Y(1043);
    page.drawRectangle({ x: sx, y: sy, width: W(206), height: W(48), borderColor: FILL, borderWidth: 0.6 });
    center("Assinado digitalmente por", 215, 1000, regular, small, FILL);
    center(input.doctor.name.toUpperCase(), 215, 1014, bold, small, FILL);
    center(`${registro} · ${issued}`, 215, 1028, regular, small, FILL);
  }
  const sigTop = 1050;
  page.drawLine({ start: { x: X(110), y: Y(sigTop) }, end: { x: X(320), y: Y(sigTop) }, thickness: 0.7, color: BLACK });
  page.drawLine({ start: { x: X(430), y: Y(sigTop) }, end: { x: X(640), y: Y(sigTop) }, thickness: 0.7, color: BLACK });
  const sm = 13 * SCALE * PT;
  center("NOME DO MÉDICO SOLICITANTE", 215, sigTop + 6, regular, sm);
  center(input.doctor.name, 215, sigTop + 21, regular, sm, FILL);
  center("CREMEB", 535, sigTop + 6, regular, sm);
  center(registro, 535, sigTop + 21, regular, sm, FILL);

  // Rodapé: identificação da assinatura digital (igual receita/exames).
  const top = 122;
  const text = (t: string, xx: number, yy: number, size: number, font = regular, color = INK) =>
    page.drawText(safe(font, t), { x: xx, y: yy, size, font, color });
  const MARGIN = 50;
  page.drawLine({ start: { x: MARGIN, y: top }, end: { x: PAGE_W - MARGIN, y: top }, thickness: 0.8, color: LINE });
  if (opts.preview) {
    text("Pré-visualização — documento ainda sem assinatura digital", MARGIN, top - 20, 10, bold);
    text("A assinatura ICP-Brasil é aplicada ao emitir o laudo.", MARGIN, top - 35, 8.5, regular, MUTED);
  } else {
    text("Documento assinado digitalmente", MARGIN, top - 20, 10, bold);
    text(`${input.doctor.name.toUpperCase()} · ${registro} · certificado ICP-Brasil`, MARGIN, top - 35, 8.5, regular, MUTED);
    text(`Emitido em ${issued}`, MARGIN, top - 48, 8.5, regular, MUTED);
    text("Documento emitido em modalidade de telemedicina (Resolução CFM nº 2.314/2022)", MARGIN, top - 61, 8.5, regular, MUTED);
    text("Confira a autenticidade da assinatura em validar.iti.gov.br", MARGIN, top - 74, 8.5, regular, MUTED);
    const place = [input.patient.city, input.patient.state].filter(Boolean).join("/");
    const right = place ? `${place}, ${issued.slice(0, 10)}` : issued.slice(0, 10);
    const r = safe(regular, right);
    text(r, PAGE_W - MARGIN - regular.widthOfTextAtSize(r, 9), top - 74, 9, regular, MUTED);
  }
  return pdf.save();
}
