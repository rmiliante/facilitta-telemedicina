import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";

/** POST /api/doctor/senha — o próprio médico troca a senha (exige a senha atual). */
export async function POST(req: NextRequest) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const atual = typeof body?.senhaAtual === "string" ? body.senhaAtual : "";
  const nova = typeof body?.novaSenha === "string" ? body.novaSenha : "";
  if (!atual || !nova) {
    return NextResponse.json({ error: "Preencha a senha atual e a nova senha." }, { status: 400 });
  }
  if (nova.length < 8) {
    return NextResponse.json({ error: "A nova senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  }
  if (nova.length > 72) {
    return NextResponse.json({ error: "A nova senha pode ter no máximo 72 caracteres." }, { status: 400 });
  }
  if (nova === atual) {
    return NextResponse.json({ error: "A nova senha precisa ser diferente da atual." }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, name, password_hash")
    .eq("id", session.doctorId)
    .maybeSingle();
  if (!doctor) return NextResponse.json({ error: "Cadastro não encontrado." }, { status: 404 });

  const ok = await bcrypt.compare(atual, doctor.password_hash);
  const actor = { type: "medico" as const, id: doctor.id, name: doctor.name };
  if (!ok) {
    await audit("doctor", { action: "troca_senha_falhou", entity: "medico", entityId: doctor.id, actor });
    return NextResponse.json({ error: "Senha atual incorreta." }, { status: 400 });
  }

  const hash = await bcrypt.hash(nova, 10);
  const { error } = await supabase.from("doctors").update({ password_hash: hash }).eq("id", doctor.id);
  if (error) return NextResponse.json({ error: "Não foi possível salvar a nova senha." }, { status: 500 });

  await audit("doctor", { action: "troca_senha", entity: "medico", entityId: doctor.id, actor });
  return NextResponse.json({ ok: true });
}
