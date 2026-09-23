import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const EDITABLE_FIELDS: Record<string, string> = {
  fullName: "full_name",
  cpf: "cpf",
  birthDate: "birth_date",
  phone: "phone",
  email: "email",
  city: "city",
  state: "state",
  notes: "notes",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: patient, error } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !patient) {
    return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
  }

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, scheduled_at, status, doctors(name), specialties(name)")
    .eq("patient_id", id)
    .order("scheduled_at", { ascending: false });

  return NextResponse.json({ patient, appointments: appointments ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(EDITABLE_FIELDS)) {
    if (key in body) update[column] = body[key] || null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("patients").update(update).eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Falha ao atualizar paciente" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
