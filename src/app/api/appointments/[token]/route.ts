import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * GET /api/appointments/:token
 * Info pública (sem login) pra tela de espera do paciente — só o
 * necessário pra ele confirmar que é a consulta certa antes de entrar.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("appointments")
    .select(
      "id, scheduled_at, status, patients(full_name), specialties(name), doctors(name)"
    )
    .eq("access_token", token)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
  }

  return NextResponse.json({ appointment: data });
}
