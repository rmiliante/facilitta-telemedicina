import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

const COLS =
  "id, full_name, cpf, birth_date, phone, email, city, state, cep, address, address_number, address_complement, neighborhood, cns";

type Row = { patient_id: string; patients: Record<string, unknown> | null };

/**
 * GET /api/doctor/patients?q=...
 * Pacientes do médico logado (os que têm ou tiveram consulta com ele), com
 * busca por nome ou CPF. Abre o cadastro e os anexos fora de uma consulta.
 */
export async function GET(req: NextRequest) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");

  const { data, error } = await getSupabaseAdmin()
    .from("appointments")
    .select("patient_id, patients(" + COLS + ")")
    .eq("doctor_id", session.doctorId)
    .limit(5000);
  if (error) {
    console.error("Erro ao listar pacientes do médico:", error);
    return NextResponse.json({ error: "Falha ao buscar pacientes" }, { status: 500 });
  }

  const seen = new Set<string>();
  const patients: Record<string, unknown>[] = [];
  for (const r of (data ?? []) as unknown as Row[]) {
    if (!r.patients || seen.has(r.patient_id)) continue;
    seen.add(r.patient_id);
    const name = String(r.patients.full_name ?? "").toLowerCase();
    const cpf = String(r.patients.cpf ?? "").replace(/\D/g, "");
    if (q && !name.includes(q) && !(qDigits.length >= 3 && cpf.includes(qDigits))) continue;
    patients.push(r.patients);
  }
  patients.sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), "pt-BR"));
  return NextResponse.json({ patients: patients.slice(0, 60) });
}
