import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";

/**
 * POST /api/admin/patients/:id/merge  { duplicateId }
 * Unifica um cadastro repetido no original (:id): as consultas, as
 * aferições e os documentos do repetido passam para o original, os
 * campos vazios do original são completados e o repetido é apagado.
 * Só aceita cadastros com o mesmo CPF.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const duplicateId = typeof body.duplicateId === "string" ? body.duplicateId : "";
  if (!duplicateId || duplicateId === id) {
    return NextResponse.json({ error: "Cadastro repetido inválido" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase.from("patients").select("*").in("id", [id, duplicateId]);
  if (error || !rows || rows.length !== 2) {
    return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
  }
  const original = rows.find((r) => r.id === id)!;
  const duplicate = rows.find((r) => r.id === duplicateId)!;
  const digits = (v: unknown) => (typeof v === "string" ? v.replace(/\D/g, "") : "");
  if (!digits(original.cpf) || digits(original.cpf) !== digits(duplicate.cpf)) {
    return NextResponse.json({ error: "Só é possível unificar cadastros com o mesmo CPF." }, { status: 400 });
  }

  // 1. Consultas
  const { error: apptErr } = await supabase.from("appointments").update({ patient_id: id }).eq("patient_id", duplicateId);
  if (apptErr) {
    console.error("Erro ao mover consultas:", apptErr);
    return NextResponse.json({ error: "Falha ao mover as consultas" }, { status: 500 });
  }

  // 2. Aferições (a tabela pode não existir ainda)
  const { error: vitErr } = await supabase.from("vital_signs").update({ patient_id: id }).eq("patient_id", duplicateId);
  if (vitErr && vitErr.code !== "42P01" && vitErr.code !== "PGRST205") {
    console.error("Erro ao mover aferições:", vitErr);
    return NextResponse.json({ error: "Falha ao mover as aferições" }, { status: 500 });
  }

  // 3. Documentos + campos vazios do original
  const update: Record<string, unknown> = {};
  const docs = [...(original.documents ?? []), ...(duplicate.documents ?? [])];
  if ((duplicate.documents ?? []).length > 0) update.documents = docs;
  for (const col of ["birth_date", "phone", "email", "city", "state", "notes"]) {
    if (!original[col] && duplicate[col]) update[col] = duplicate[col];
  }
  if (Object.keys(update).length > 0) {
    const { error: upErr } = await supabase.from("patients").update(update).eq("id", id);
    if (upErr) {
      console.error("Erro ao completar cadastro original:", upErr);
      return NextResponse.json({ error: "Falha ao atualizar o cadastro original" }, { status: 500 });
    }
  }

  // 4. Apaga o repetido (já sem consultas, aferições e documentos)
  const { error: delErr } = await supabase.from("patients").delete().eq("id", duplicateId);
  if (delErr) {
    console.error("Erro ao apagar cadastro repetido:", delErr);
    return NextResponse.json({ error: "Tudo foi movido, mas não foi possível apagar o cadastro repetido." }, { status: 500 });
  }

  await audit("staff", {
    action: "unificar_paciente",
    entity: "paciente",
    entityId: id,
    patientId: id,
    patientName: original.full_name,
    details: { repetido: duplicateId },
  });
  return NextResponse.json({ ok: true, moved: { documents: (duplicate.documents ?? []).length } });
}
