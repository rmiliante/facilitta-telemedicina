import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/** PATCH /api/admin/specialties/:id — editar nome e/ou cota mensal. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    update.name = body.name.trim();
  }
  if (typeof body.monthlyQuota === "number" && body.monthlyQuota > 0) {
    update.monthly_quota = body.monthlyQuota;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("specialties").update(update).eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: "Falha ao atualizar especialidade (talvez o nome já exista)" },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}

/** DELETE /api/admin/specialties/:id */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("specialties").delete().eq("id", id);

  if (error) {
    return NextResponse.json(
      {
        error:
          "Não foi possível excluir: essa especialidade tem médicos ou consultas vinculados.",
      },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
