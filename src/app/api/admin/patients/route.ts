import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("q")?.trim();
  const supabase = getSupabaseAdmin();

  let query = supabase.from("patients").select("*").order("full_name", { ascending: true });
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,cpf.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Falha ao buscar pacientes" }, { status: 500 });
  }
  return NextResponse.json({ patients: data });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { fullName, cpf, birthDate, phone, email, city, state, notes } = body ?? {};

  if (typeof fullName !== "string" || !fullName.trim()) {
    return NextResponse.json({ error: "fullName é obrigatório" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("patients")
    .insert({
      full_name: fullName.trim(),
      cpf: cpf || null,
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
  return NextResponse.json({ patient: data });
}
