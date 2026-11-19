import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { isDayKey } from "@/lib/format";
import { audit } from "@/lib/audit";

/** GET ?doctorId=&date=YYYY-MM-DD → { encerrada } */
export async function GET(req: NextRequest) {
  const doctorId = req.nextUrl.searchParams.get("doctorId") || "";
  const date = req.nextUrl.searchParams.get("date") || "";
  if (!doctorId || !isDayKey(date)) return NextResponse.json({ encerrada: false });
  const { data } = await getSupabaseAdmin()
    .from("agenda_encerrada")
    .select("closed_at")
    .eq("day", date)
    .eq("doctor_id", doctorId)
    .maybeSingle();
  return NextResponse.json({ encerrada: !!data, closedAt: data?.closed_at ?? null });
}

/** POST { doctorId, date, acao: "encerrar" | "reabrir" } — não mexe nas consultas já agendadas. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { doctorId, date, acao } = body ?? {};
  if (typeof doctorId !== "string" || !doctorId || typeof date !== "string" || !isDayKey(date)) {
    return NextResponse.json({ error: "doctorId e date são obrigatórios" }, { status: 400 });
  }
  const supabase = getSupabaseAdmin();
  if (acao === "reabrir") {
    const { error } = await supabase.from("agenda_encerrada").delete().eq("day", date).eq("doctor_id", doctorId);
    if (error) return NextResponse.json({ error: "Falha ao reabrir a agenda" }, { status: 500 });
    await audit("staff", { action: "reabrir_agenda", entity: "agenda", entityId: doctorId, details: { data: date } });
    return NextResponse.json({ ok: true, encerrada: false });
  }
  const { error } = await supabase
    .from("agenda_encerrada")
    .upsert({ day: date, doctor_id: doctorId, closed_at: new Date().toISOString(), ack_at: null }, { onConflict: "day,doctor_id" });
  if (error) {
    console.error("Erro ao encerrar agenda:", error);
    return NextResponse.json({ error: "Falha ao encerrar a agenda" }, { status: 500 });
  }
  await audit("staff", { action: "encerrar_agenda", entity: "agenda", entityId: doctorId, details: { data: date } });
  return NextResponse.json({ ok: true, encerrada: true });
}
