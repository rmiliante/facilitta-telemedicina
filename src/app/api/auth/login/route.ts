import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createDoctorSession } from "@/lib/auth";

/**
 * POST /api/auth/login
 * Login do médico (e-mail + senha cadastrados pela equipe no /admin).
 */
export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return NextResponse.json(
      { error: "E-mail e senha são obrigatórios" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();

  const { data: doctor, error } = await supabase
    .from("doctors")
    .select("id, name, email, password_hash, active")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();

  if (error || !doctor || !doctor.active) {
    return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 401 });
  }

  const passwordMatches = await bcrypt.compare(password, doctor.password_hash);
  if (!passwordMatches) {
    return NextResponse.json({ error: "E-mail ou senha inválidos" }, { status: 401 });
  }

  await createDoctorSession({
    doctorId: doctor.id,
    name: doctor.name,
    email: doctor.email,
  });

  return NextResponse.json({ ok: true });
}
