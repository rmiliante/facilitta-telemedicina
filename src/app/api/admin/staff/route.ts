import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("staff")
    .select("id, name, email, role, active, created_at")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Falha ao buscar equipe" }, { status: 500 });
  }
  return NextResponse.json({ staff: data });
}

export async function POST(req: NextRequest) {
  const { name, email, password, role } = await req.json().catch(() => ({}));

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    password.length < 6 ||
    (role !== "admin" && role !== "atendente")
  ) {
    return NextResponse.json(
      { error: "name, email, password (mín. 6 caracteres) e role (admin/atendente) são obrigatórios" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("staff")
    .insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      role,
    })
    .select("id, name, email, role, active, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Falha ao criar membro da equipe (e-mail já pode estar em uso)" },
      { status: 400 }
    );
  }
  return NextResponse.json({ staff: data });
}
