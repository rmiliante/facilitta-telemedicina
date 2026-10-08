import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { importApplications, type InRow } from "@/lib/importApplications";

/**
 * POST /api/public/doctor-applications/intake — entrada automática de
 * candidatos orgânicos (e-mail "[Novo Cadastro Profissional]" via Power Automate
 * ou envio direto do formulário do site). Protegido pelo header
 * "x-intake-secret" (variável DOCTOR_INTAKE_SECRET).
 *
 * Aceita JSON: { nome, email, telefone, cidade, estado, tipo_profissional,
 * registro_profissional, especialidade, como_gostaria_colaborar, comentarios,
 * ideia_inovadora, recebido_em } ou { text: "<corpo do e-mail>" } com linhas "Campo: valor".
 */

const LABELS: Record<string, keyof InRow> = {
  nome: "name",
  "nome completo": "name",
  email: "email",
  "e-mail": "email",
  telefone: "phone",
  whatsapp: "phone",
  celular: "phone",
  cidade: "city",
  estado: "state",
  uf: "state",
  "tipo profissional": "profession",
  "tipo de profissional": "profession",
  profissao: "profession",
  profissão: "profession",
  registro: "registry",
  "registro profissional": "registry",
  crm: "registry",
  especialidade: "specialty",
  "como gostaria de colaborar": "collaboration",
  comentarios: "comments",
  comentários: "comments",
  "ideia inovadora": "idea",
  "enviado em": "receivedAt",
};

/** Corpo de e-mail em HTML -> texto com uma linha por campo. */
function htmlToText(v: string): string {
  if (!/<[a-z!/][^>]*>/i.test(v)) return v;
  return v
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\s*(br|\/p|\/div|\/tr|\/li|\/h\d)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const EMPTY = /^[—–-]+$/;

function parseText(text: string): InRow {
  const row: InRow = {};
  for (const line of htmlToText(text).split(/\r?\n/)) {
    const m = line.match(/^\s*([^:]{2,40}):\s*(.+)$/);
    if (!m) continue;
    const key = LABELS[m[1].trim().toLowerCase().replace(/[_]/g, " ")];
    const val = m[2].trim();
    if (key && !row[key] && !EMPTY.test(val)) row[key] = val;
  }
  return row;
}

function fromJson(b: Record<string, unknown>): InRow {
  const s = (...k: string[]) => {
    for (const x of k) if (typeof b[x] === "string" && (b[x] as string).trim()) return (b[x] as string).trim();
    return undefined;
  };
  const base: InRow = typeof b.text === "string" ? parseText(b.text) : {};
  return {
    name: s("nome", "name") ?? base.name,
    email: s("email") ?? base.email,
    phone: s("telefone", "phone") ?? base.phone,
    city: s("cidade", "city") ?? base.city,
    state: s("estado", "state") ?? base.state,
    profession: s("tipo_profissional", "profession") ?? base.profession,
    registry: s("registro_profissional", "registry") ?? base.registry,
    specialty: s("especialidade", "specialty") ?? base.specialty,
    collaboration: s("como_gostaria_colaborar", "collaboration") ?? base.collaboration,
    comments: s("comentarios", "comments") ?? base.comments,
    idea: s("ideia_inovadora", "idea") ?? base.idea,
    receivedAt: s("recebido_em", "receivedAt") ?? new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  const secret = process.env.DOCTOR_INTAKE_SECRET ?? "";
  const given = req.headers.get("x-intake-secret") ?? "";
  const a = Buffer.from(secret);
  const b = Buffer.from(given);
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const rows = Array.isArray(body.rows) ? body.rows.map(fromJson) : [fromJson(body)];
  const out = await importApplications(rows);
  return NextResponse.json(out.body, { status: out.status });
}
