import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

/** DELETE /api/doctor/modelos/:id — exclui um modelo do próprio médico. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const { error } = await getSupabaseAdmin()
    .from("prescription_templates")
    .delete()
    .eq("id", id)
    .eq("doctor_id", session.doctorId);
  if (error) return NextResponse.json({ error: "Falha ao excluir o modelo" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
