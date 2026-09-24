import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const STATUS_KEYS = ["agendado", "em_andamento", "concluido", "cancelado", "faltou"] as const;

/**
 * GET /api/admin/dashboard
 * Agrega dados de atendimento pra alimentar os gráficos do dashboard
 * do admin: total por status, evolução diária (últimos 30 dias),
 * volume por especialidade e por médico. Busca os atendimentos dos
 * últimos 90 dias e agrega tudo em memória (volume ainda é pequeno o
 * suficiente pra não precisar de uma view/RPC no banco).
 */
export async function GET() {
  const supabase = getSupabaseAdmin();

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 90);
  since.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("appointments")
    .select("id, scheduled_at, status, doctors(name), specialties(name)")
    .gte("scheduled_at", since.toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar dados do dashboard:", error);
    return NextResponse.json({ error: "Falha ao buscar dados do dashboard" }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as {
    id: string;
    scheduled_at: string;
    status: string;
    doctors: { name: string } | null;
    specialties: { name: string } | null;
  }[];

  // Totais por status (base pros KPIs de topo e pro gráfico de status).
  const totals: Record<string, number> = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]));
  for (const row of rows) {
    if (row.status in totals) totals[row.status] += 1;
  }

  // Série diária dos últimos 30 dias (dia sem atendimento entra com 0,
  // pra o eixo não ficar com buracos).
  const days: { date: string; count: number }[] = [];
  const dayMap = new Map<string, number>();
  for (const row of rows) {
    const day = row.scheduled_at.slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  const cursor = new Date();
  cursor.setUTCDate(cursor.getUTCDate() - 29);
  cursor.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < 30; i++) {
    const key = cursor.toISOString().slice(0, 10);
    days.push({ date: key, count: dayMap.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // Volume por especialidade e por médico (top 8 de cada, resto agrupado
  // em "Outras"/"Outros" pra não estourar o gráfico).
  function topGroups(getKey: (r: (typeof rows)[number]) => string | null, otherLabel: string) {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = getKey(row);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 8).map(([name, count]) => ({ name, count }));
    const restCount = sorted.slice(8).reduce((sum, [, count]) => sum + count, 0);
    if (restCount > 0) top.push({ name: otherLabel, count: restCount });
    return top;
  }

  const bySpecialty = topGroups((r) => r.specialties?.name ?? null, "Outras");
  const byDoctor = topGroups((r) => r.doctors?.name ?? null, "Outros");

  return NextResponse.json({
    totals,
    total: rows.length,
    byDay: days,
    bySpecialty,
    byDoctor,
    rangeDays: 90,
  });
}
