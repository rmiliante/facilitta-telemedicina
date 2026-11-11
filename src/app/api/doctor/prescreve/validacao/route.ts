import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { PrescricoesError, prescricoesAtivo, validarDocumentoProfissional } from "@/lib/prescrevePrescricoes";

export const maxDuration = 60;

/** Envia a carteira do CRM da médica para validação na Prescreve (atrás da flag). */
export async function POST(req: NextRequest) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  if (!prescricoesAtivo()) return NextResponse.json({ error: "Recurso desativado" }, { status: 404 });

  const supabase = getSupabaseAdmin();
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, prescreve_uuid")
    .eq("id", session.doctorId)
    .maybeSingle();
  if (!doctor?.prescreve_uuid) {
    return NextResponse.json({ error: "Vincule sua conta da Prescreve primeiro" }, { status: 409 });
  }

  const form = await req.formData().catch(() => null);
  const token = form ? String(form.get("token") || "") : "";
  const file = form ? form.get("file") : null;
  if (!token) return NextResponse.json({ error: "Confirme sua conta com o código do e-mail e tente de novo" }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Escolha a foto da carteira" }, { status: 400 });
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "O arquivo passa de 10 MB" }, { status: 400 });
  if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.type)) {
    return NextResponse.json({ error: "Envie JPG, PNG ou PDF" }, { status: 400 });
  }

  try {
    const info = { arquivo: file.name, tipo: file.type, bytes: file.size };
    const r = await validarDocumentoProfissional(token, file, file.name || "carteira").catch(async (e: unknown) => {
      await supabase.from("audit_log").insert({ actor_type: "doctor", actor_id: doctor.id, action: "prescreve_validacao_crm_erro", entity: "doctors", entity_id: String(doctor.id), details: { ...info, status: (e as { status?: number }).status ?? null, mensagem: e instanceof Error ? e.message : String(e) } });
      throw e;
    });
    await supabase.from("audit_log").insert({ actor_type: "doctor", actor_id: doctor.id, action: "prescreve_validacao_crm", entity: "doctors", entity_id: String(doctor.id), details: { ...info, validado: r.validado, motivo: r.motivo } });
    if (r.validado) {
      await supabase.from("doctors").update({ prescreve_crm_validado_em: new Date().toISOString() }).eq("id", doctor.id);
    }
    return NextResponse.json({ ok: true, validado: r.validado, motivo: r.motivo, raw: r.validado ? undefined : r.raw });
  } catch (err) {
    if (err instanceof PrescricoesError) {
      return NextResponse.json({ error: err.message }, { status: err.status >= 400 && err.status < 600 ? err.status : 502 });
    }
    console.error("Erro ao validar CRM na Prescreve:", err);
    return NextResponse.json({ error: "Falha ao enviar o documento" }, { status: 500 });
  }
}
