import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { cpfLikePattern, formatCpf, sanitizeSearch } from "@/lib/format";
import { findPatientsByCpf } from "@/lib/patientLookup";
import { faltasPorPaciente } from "@/lib/reports";
import { audit } from "@/lib/audit";
import { currentStaffRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // ?cpf=... → confere se já existe cadastro com esse CPF (aviso no formulário).
  const cpfParam = req.nextUrl.searchParams.get("cpf");
  if (cpfParam !== null) {
    return NextResponse.json({ matches: await findPatientsByCpf(cpfParam) });
  }

  const search = sanitizeSearch(req.nextUrl.searchParams.get("q") ?? "");
  const supabase = getSupabaseAdmin();

  let query = supabase.from("patients").select("*").order("full_name", { ascending: true });
  if (search) {
    // Busca pelo nome ou pelo CPF, com ou sem pontuação.
    const cpfPattern = cpfLikePattern(search);
    query = query.or(
      cpfPattern ? `full_name.ilike.%${search}%,cpf.ilike.${cpfPattern}` : `full_name.ilike.%${search}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Falha ao buscar pacientes" }, { status: 500 });
  }
  // Nível Agendamento: só o básico para achar o paciente (sem contatos extras nem notas).
  if ((await currentStaffRole()) === "agendamento") {
    return NextResponse.json({
      patients: (data ?? []).map((p) => ({ id: p.id, full_name: p.full_name, cpf: p.cpf, phone: p.phone, birth_date: p.birth_date })),
    });
  }
  // Faltas por paciente (lista do admin marca quem falta com frequência).
  const faltas = await faltasPorPaciente((data ?? []).map((p) => p.id));
  return NextResponse.json({ patients: (data ?? []).map((p) => ({ ...p, faltas: faltas[p.id] ?? 0 })) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { fullName, cpf, birthDate, phone, email, city, state, notes } = body ?? {};

  if (typeof fullName !== "string" || !fullName.trim()) {
    return NextResponse.json({ error: "fullName é obrigatório" }, { status: 400 });
  }

  // Nível Agendamento: CPF completo é obrigatório (é ele que impede cadastro duplicado).
  if ((await currentStaffRole()) === "agendamento" && (typeof cpf !== "string" || cpf.replace(/\D/g, "").length !== 11)) {
    return NextResponse.json({ error: "Informe o CPF completo (11 números)." }, { status: 400 });
  }

  // Não cria cadastro repetido: se o CPF já existe, devolve o original.
  const existing = await findPatientsByCpf(cpf);
  if (existing.length > 0) {
    return NextResponse.json(
      { error: `Paciente já cadastrado com esse CPF: ${existing[0].full_name}.`, existing: existing[0] },
      { status: 409 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("patients")
    .insert({
      full_name: fullName.trim(),
      cpf: formatCpf(cpf),
      birth_date: birthDate || null,
      phone: phone || null,
      email: email || null,
      city: city || null,
      state: state || null,
      notes: notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar paciente:", error);
    return NextResponse.json({ error: "Falha ao criar paciente" }, { status: 500 });
  }
  await audit("staff", { action: "criar_paciente", entity: "paciente", entityId: data.id, patientId: data.id, patientName: data.full_name });
  return NextResponse.json({ patient: data });
}
