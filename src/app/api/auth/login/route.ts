import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createDoctorSession, DUMMY_PASSWORD_HASH } from "@/lib/auth";
import { audit, LOGIN_LOCKED_MESSAGE, loginLocked } from "@/lib/audit";

/**
 * POST /api/auth/login
 * Login do médico (e-mail + senha cadastrados pela equipe no /admin).
 * Depois de várias senhas erradas seguidas, bloqueia por alguns minutos.
 */
export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json(
      { error: "E-mail e senha são obrigatórios" },
      { status: 400 }
    );
  }

  const normalized = email.toLowerCase().trim();
  const anon = { type: "anonimo" as const, id: null, name: normalized };
  if (await loginLocked(normalized)) {
    await audit("doctor", { action: "login_bloqueado", entity: "medico", entityId: normalized, actor: anon });
    return NextResponse.json({ error: LOGIN_LOCKED_MESSAGE }, { status: 429 });
  }

  const supabase = getSupabaseAdmin();

  const { data: doctor, error } = await supabase
    .from("doctors")
    .select("id, name, email, password_hash, active")
    .eq("email", normalized)
    .maybeSingle();

  if (error || !doctor || !doctor.active) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    await audit("doctor", { action: "login_falhou", entity: "medico", entityId: normalized, actor: anon });
    return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 401 });
  }

  const passwordMatches = await bcrypt.compare(password, doctor.password_hash);
  if (!passwordMatches) {
    await audit("doctor", { action: "login_falhou", entity: "medico", entityId: normalized, actor: anon });
    return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 401 });
  }

  await createDoctorSession({
    doctorId: doctor.id,
    name: doctor.name,
    email: doctor.email,
  });
  await audit("doctor", {
    action: "login_ok",
    entity: "medico",
    entityId: normalized,
    actor: { type: "medico", id: doctor.id, name: doctor.name },
  });

  return NextResponse.json({ ok: true });
}
