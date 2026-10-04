import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("specialties")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Falha ao buscar especialidades" }, { status: 500 });
  }
  return NextResponse.json({ specialties: data });
}

export async function POST(req: NextRequest) {
  const { name, monthlyQuota } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("specialties")
    .insert({
      name: name.trim(),
      monthly_quota:
        typeof monthlyQuota === "number" && monthlyQuota > 0 ? monthlyQuota : 50,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Falha ao criar especialidade (talvez já exista)" },
      { status: 400 }
    );
  }
  return NextResponse.json({ specialty: data });
}
