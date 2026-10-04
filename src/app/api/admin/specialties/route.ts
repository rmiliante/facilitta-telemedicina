import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseConsultFee } from "@/lib/doctorFields";
import { CONTRACT_FEE_WARNING } from "@/lib/contract";

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
  const { name, monthlyQuota, contractFee } = await req.json().catch(() => ({}));
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });
  }
  // Valor que recebemos por consulta (contrato). Vazio = ainda não definido.
  const fee = parseConsultFee(contractFee);
  if (fee === undefined) {
    return NextResponse.json({ error: "Valor por consulta inválido (ex: 120,00)" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const row: Record<string, unknown> = {
    name: name.trim(),
    monthly_quota: typeof monthlyQuota === "number" && monthlyQuota > 0 ? monthlyQuota : 50,
    contract_fee: fee,
  };
  const insert = () => supabase.from("specialties").insert(row).select().single();
  let { data, error } = await insert();
  let warning: string | undefined;
  if (error && /contract_fee/.test(error.message ?? "")) {
    delete row.contract_fee;
    if (fee !== null) warning = CONTRACT_FEE_WARNING;
    ({ data, error } = await insert());
  }

  if (error) {
    return NextResponse.json(
      { error: "Falha ao criar especialidade (talvez já exista)" },
      { status: 400 }
    );
  }
  return NextResponse.json({ specialty: data, warning });
}
