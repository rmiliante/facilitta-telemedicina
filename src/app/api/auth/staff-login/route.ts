import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createStaffSession, DUMMY_PASSWORD_HASH } from "@/lib/auth";
import { audit, LOGIN_LOCKED_MESSAGE, loginLocked } from "@/lib/audit";

/**
 * POST /api/auth/staff-login
 * Login da equipe (admin ou atendente), cadastrados no /admin > Equipe.
 * Depois de várias senhas erradas seguidas, bloqueia por alguns minutos.
 */
export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "E-mail e senha são obrigatórios" }, { status: 400 });
  }

  const normalized = email.toLowerCase().trim();
  const anon = { type: "anonimo" as const, id: null, name: normalized };
  if (await loginLocked(normalized)) {
    await audit("staff", { action: "login_bloqueado", entity: "equipe", entityId: normalized, actor: anon });
    return NextResponse.json({ error: LOGIN_LOCKED_MESSAGE }, { status: 429 });
  }

  const supabase = getSupabaseAdmin();

  const { data: staff, error } = await supabase
    .from("staff")
    .select("id, name, email, password_hash, role, active")
    .eq("email", normalized)
    .maybeSingle();

  if (error || !staff || !staff.active) {
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
    await audit("staff", { action: "login_falhou", entity: "equipe", entityId: normalized, actor: anon });
    return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 401 });
  }

  const passwordMatches = await bcrypt.compare(password, staff.password_hash);
  if (!passwordMatches) {
    await audit("staff", { action: "login_falhou", entity: "equipe", entityId: normalized, actor: anon });
    return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 401 });
  }

  await createStaffSession({
    staffId: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
  });
  await audit("staff", {
    action: "login_ok",
    entity: "equipe",
    entityId: normalized,
    actor: { type: staff.role, id: staff.id, name: staff.name },
  });

  return NextResponse.json({ ok: true, role: staff.role });
}
