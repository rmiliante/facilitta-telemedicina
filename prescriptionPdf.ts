import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Gera o PDF da receita / pedido de exame / atestado (ainda sem
 * assinatura — a assinatura ICP-Brasil é aplicada depois pela Prescreve).
 */

export type PrescriptionKind = "receita" | "exame" | "atestado";

export interface PrescriptionItem {
  name: string;
  quantity?: string;
  instructions?: string;
}

export interface PrescriptionPdfInput {
  kind: PrescriptionKind;
  doctor: {
    name: string;
    crm: string;
    crmUf: string;
    rqe?: string | null;
    specialty?: string | null;
    /** Endereço profissional (obrigatório na prescrição por telemedicina, Res. CFM 2.314/2022). */
    address?: string | null;
  };
  patient: {
    name: string;
    cpf?: string | null;
    birthDate?: string | null; // YYYY-MM-DD
    city?: string | null;
    state?: string | null;
  };
  items: PrescriptionItem[];
  notes?: string;
  issuedAt: Date;
}

export const KIND_TITLES: Record<PrescriptionKind, string> = {
  receita: "RECEITUÁRIO",
  exame: "SOLICITAÇÃO DE EXAMES",
  atestado: "ATESTADO MÉDICO",
};

const NAVY = rgb(0x15 / 255, 0x00 / 255, 0x4d / 255);
const INK = rgb(0.11, 0.09, 0.19);
const MUTED = rgb(0.29, 0.27, 0.38);
const LINE = rgb(0.84, 0.82, 0.78);

const PAGE_W = 595.28; // A4 em pontos
const PAGE_H = 841.89;
const MARGIN = 50;

function formatDateBR(iso?: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : null;
}

function formatCpf(cpf?: string | null) {
  const d = (cpf ?? "").replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf || null;
}

function formatIssued(date: Date) {
  const f = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return f.format(date).replace(",", "");
}

/** Troca caracteres que a fonte padrão do PDF não suporta (emoji etc.). */
function safe(font: PDFFont, text: string) {
  let out = "";
  for (const ch of text.replace(/\r/g, "").replace(/\t/g, "  ")) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += ch === "\n" ? "\n" : "";
    }
  }
  return out;
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export async function buildPrescriptionPdf(input: PrescriptionPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${KIND_TITLES[input.kind]} - ${input.patient.name}`);
  pdf.setAuthor(input.doctor.name);
  pdf.setCreator("Receituário digital");
  pdf.setProducer("Receituário digital");
  pdf.setLanguage("pt-BR");

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const contentWidth = PAGE_W - MARGIN * 2;
  const registro = [
    `CRM-${input.doctor.crmUf.toUpperCase()} ${input.doctor.crm}`,
    input.doctor.rqe ? `RQE ${input.doctor.rqe}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const FOOTER_TOP = 162; // espaço reservado pro bloco de assinatura

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const text = (t: string, x: number, yy: number, size: number, font = regular, color = INK) =>
    page.drawText(safe(font, t), { x, y: yy, size, font, color });

  // Cabeçalho só com os dados do médico (sem marca de empresa).
  function drawHeader() {
    const right = PAGE_W - MARGIN;
    const lines: [string, PDFFont, number, typeof INK][] = [
      [input.doctor.name, bold, 16, NAVY],
      [[input.doctor.specialty, registro].filter(Boolean).join(" · "), regular, 10, INK],
    ];
    if (input.doctor.address) {
      for (const l of wrap(regular, safe(regular, input.doctor.address), 9, contentWidth)) {
        lines.push([l, regular, 9, MUTED]);
      }
    }
    let ly = y - 16;
    for (const [t, f, s, c] of lines) {
      text(t, MARGIN, ly, s, f, c);
      ly -= s + 5;
    }
    y = ly - 4;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 1.5, color: NAVY });
    y -= 34;
  }

  function newPageIfNeeded(needed: number) {
    if (y - needed > FOOTER_TOP) return;
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
    drawHeader();
  }

  drawHeader();

  // Título
  const title = KIND_TITLES[input.kind];
  text(title, (PAGE_W - bold.widthOfTextAtSize(title, 15)) / 2, y, 15, bold, NAVY);
  y -= 30;

  // Paciente
  const p = input.patient;
  const patientFields: [string, string | null | undefined][] = [
    ["Paciente", p.name],
    ["CPF", formatCpf(p.cpf)],
    ["Nascimento", formatDateBR(p.birthDate)],
    ["Cidade", p.city ? `${p.city}${p.state ? `/${p.state}` : ""}` : null],
  ];
  const place = [p.city, p.state].filter(Boolean).join("/");
  const colW = contentWidth / 2;
  patientFields
    .filter(([, v]) => v)
    .forEach(([label, value], i) => {
      const x = MARGIN + (i % 2) * colW;
      const yy = y - Math.floor(i / 2) * 16;
      text(`${label}: `, x, yy, 10, bold);
      text(String(value), x + bold.widthOfTextAtSize(`${label}: `, 10), yy, 10);
    });
  y -= Math.ceil(patientFields.filter(([, v]) => v).length / 2) * 16;
  const local = `Teleconsulta${place ? ` · paciente em ${place}` : ""}`;
  text("Local do atendimento: ", MARGIN, y, 10, bold);
  text(local, MARGIN + bold.widthOfTextAtSize("Local do atendimento: ", 10), y, 10);
  y -= 34;

  // Corpo
  if (input.kind === "atestado") {
    for (const line of wrap(regular, safe(regular, input.notes ?? ""), 11, contentWidth)) {
      newPageIfNeeded(16);
      text(line, MARGIN, y, 11);
      y -= 16;
    }
  } else {
    input.items.forEach((item, idx) => {
      const head = `${idx + 1}. ${item.name}`;
      const qty = item.quantity?.trim() ? item.quantity.trim() : "";
      const headLines = wrap(bold, safe(bold, head), 11, contentWidth - (qty ? 130 : 0));
      newPageIfNeeded(headLines.length * 15 + 30);
      headLines.forEach((l, li) => {
        text(l, MARGIN, y, 11, bold);
        if (li === 0 && qty) {
          const q = safe(bold, qty);
          text(q, PAGE_W - MARGIN - bold.widthOfTextAtSize(q, 11), y, 11, bold);
        }
        y -= 15;
      });
      if (item.instructions?.trim()) {
        for (const line of wrap(regular, safe(regular, item.instructions.trim()), 10, contentWidth - 14)) {
          newPageIfNeeded(14);
          text(line, MARGIN + 14, y, 10, regular, MUTED);
          y -= 14;
        }
      }
      y -= 10;
    });

    if (input.notes?.trim()) {
      newPageIfNeeded(40);
      y -= 4;
      text("Observações", MARGIN, y, 10, bold);
      y -= 15;
      for (const line of wrap(regular, safe(regular, input.notes.trim()), 10, contentWidth)) {
        newPageIfNeeded(14);
        text(line, MARGIN, y, 10, regular, MUTED);
        y -= 14;
      }
    }
  }

  // Rodapé (em todas as páginas): identificação da assinatura digital.
  const issued = formatIssued(input.issuedAt);
  const pages = pdf.getPages();
  pages.forEach((pg, i) => {
    page = pg;
    const top = 122;
    page.drawLine({ start: { x: MARGIN, y: top }, end: { x: PAGE_W - MARGIN, y: top }, thickness: 0.8, color: LINE });
    text("Documento assinado digitalmente", MARGIN, top - 20, 10, bold);
    text(
      `${input.doctor.name.toUpperCase()} · ${registro} · certificado ICP-Brasil`,
      MARGIN,
      top - 35,
      8.5,
      regular,
      MUTED
    );
    text(`Emitido em ${issued}`, MARGIN, top - 48, 8.5, regular, MUTED);
    text("Documento emitido em modalidade de telemedicina (Resolução CFM nº 2.314/2022)", MARGIN, top - 61, 8.5, regular, MUTED);
    text("Confira a autenticidade da assinatura em validar.iti.gov.br", MARGIN, top - 74, 8.5, regular, MUTED);
    const right = place ? `${place}, ${issued.slice(0, 10)}` : issued.slice(0, 10);
    const r = safe(regular, right);
    text(r, PAGE_W - MARGIN - regular.widthOfTextAtSize(r, 9), top - 74, 9, regular, MUTED);
    if (pages.length > 1) {
      const pn = `Página ${i + 1} de ${pages.length}`;
      text(pn, PAGE_W - MARGIN - regular.widthOfTextAtSize(pn, 8), 40, 8, regular, MUTED);
    }
  });

  return pdf.save();
}
