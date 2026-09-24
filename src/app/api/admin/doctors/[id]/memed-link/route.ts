import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { upsertMemedDoctor } from "@/lib/memed";

/**
 * POST /api/admin/doctors/:id/memed-link
 * Vincula o médico como "prescritor" na Memed (cadastro via API,
 * usando o id dele no nosso banco como external_id) — depois disso,
 * o módulo de prescrição da Memed pode ser embutido na tela de
 * consulta desse médico. Body: { cpf, crm, uf, birthDate (YYYY-MM-DD) }.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { cpf, crm, uf, birthDate } = body ?? {};

  if (
    typeof cpf !== "string" ||
    cpf.replace(/\D/g, "").length !== 11 ||
    typeof crm !== "string" ||
    !crm.trim() ||
    typeof uf !== "string" ||
    uf.trim().length !== 2 ||
    typeof birthDate !== "string" ||
    !birthDate
  ) {
    return NextResponse.json(
      { error: "cpf (11 dígitos), crm, uf e birthDate são obrigatórios" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: doctor, error: fetchErr } = await supabase
    .from("doctors")
    .select("id, name, email")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !doctor) {
    return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });
  }

  // Memed espera dd/mm/aaaa; recebemos YYYY-MM-DD do <input type="date">.
  const [y, m, d] = birthDate.split("-");
  const dataNascimento = `${d}/${m}/${y}`;

  try {
    await upsertMemedDoctor({
      externalId: doctor.id,
      nome: doctor.name,
      cpf,
      crm,
      uf,
      email: doctor.email,
      dataNascimento,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao vincular na Memed" },
      { status: 502 }
    );
  }

  const { error: updateErr } = await supabase
    .from("doctors")
    .update({
      memed_cpf: cpf.replace(/\D/g, ""),
      memed_crm: crm.replace(/\D/g, ""),
      memed_uf: uf.toUpperCase(),
      memed_birth_date: birthDate,
      memed_linked_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: "Vinculado na Memed, mas falhou ao salvar no cadastro" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
