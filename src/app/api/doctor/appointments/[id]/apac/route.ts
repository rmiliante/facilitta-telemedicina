import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getOwnedAppointment } from "@/lib/appointments";
import { getSupabaseAdmin } from "@/lib/supabase";
import { listApacProcedures } from "@/lib/apacProcedures";

/** Dados pra preencher o laudo de APAC: campos já salvos do paciente e procedimentos usados antes. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const appointment = await getOwnedAppointment(id, session.doctorId);
  if (!appointment) return NextResponse.json({ error: "Consulta não encontrada" }, { status: 404 });

  const { data } = await getSupabaseAdmin()
    .from("patients")
    .select("cns, mother_name, sex, address, cep")
    .eq("id", appointment.patient_id)
    .maybeSingle();
  return NextResponse.json({ patient: data ?? null, procedures: await listApacProcedures() });
}
