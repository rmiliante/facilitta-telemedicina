import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { doctorCanAccessPatient } from "@/lib/appointments";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit, patientName } from "@/lib/audit";

// O médico edita só contato e endereço. Nome e CPF ficam com o Master.
const EDITABLE_FIELDS: Record<string, string> = {
  birthDate: "birth_date",
  phone: "phone",
  email: "email",
  city: "city",
  state: "state",
  cep: "cep",
  address: "address",
  addressNumber: "address_number",
  addressComplement: "address_complement",
  neighborhood: "neighborhood",
};

/** PATCH /api/doctor/patients/:id — atualiza contato e endereço do paciente do médico. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  if (!(await doctorCanAccessPatient(session.doctorId, id))) {
    return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(EDITABLE_FIELDS)) {
    if (key in body) update[column] = body[key] || null;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin().from("patients").update(update).eq("id", id);
  if (error) {
    console.error("Erro ao atualizar paciente (médico):", error);
    return NextResponse.json({ error: "Falha ao atualizar paciente" }, { status: 500 });
  }
  await audit("doctor", { action: "editar_paciente", entity: "paciente", entityId: id, patientId: id, patientName: await patientName(id) });
  return NextResponse.json({ ok: true });
}
