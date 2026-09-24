import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createStaffSession } from "@/lib/auth";

/**
 * POST /api/auth/staff-login
 * Login da equipe (admin ou atendente), cadastrados no /admin > Equipe.
 */
export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json({ error: "E-mail e senha são obrigatórios" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: staff, error } = await supabase
    .from("staff")
    .select("id, name, email, password_hash, role, active")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  if (error || !staff || !staff.active) {
    return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 401 });
  }

  const passwordMatches = await bcrypt.compare(password, staff.password_hash);
  if (!passwordMatches) {
    return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 401 });
  }

  await createStaffSession({
    staffId: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
  });

  return NextResponse.json({ ok: true, role: staff.role });
}
