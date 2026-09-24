import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("doctors")
    .select("id, name, email, specialty_id, active, created_at, booth_token, specialties(name)")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Falha ao buscar médicos" }, { status: 500 });
  }
  return NextResponse.json({ doctors: data });
}

export async function POST(req: NextRequest) {
  const { name, email, password, specialtyId } = await req.json().catch(() => ({}));

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    password.length < 6
  ) {
    return NextResponse.json(
      { error: "name, email e password (mín. 6 caracteres) são obrigatórios" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("doctors")
    .insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password_hash: passwordHash,
      specialty_id: typeof specialtyId === "string" && specialtyId ? specialtyId : null,
    })
    .select("id, name, email, specialty_id, active, created_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Falha ao criar médico (e-mail já pode estar em uso)" },
      { status: 400 }
    );
  }
  return NextResponse.json({ doctor: data });
}
