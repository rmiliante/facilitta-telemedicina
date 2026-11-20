import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { financeErrorResponse } from "@/lib/financeApi";

/**
 * GET /api/admin/fluxo-caixa/competencia — base do DRE "por agendamentos":
 * por mês e por médico, quantos agendamentos (sem cancelados), quantas consultas
 * realizadas e quanto cada profissional recebe por elas (doctor_fee).
 */
interface Row {
  scheduled_at: string;
  status: string;
  doctor_fee: number | string | null;
  doctor_id: string | null;
  doctors: { name: string } | { name: string }[] | null;
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const rows: Row[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("appointments")
        .select("scheduled_at, status, doctor_fee, doctor_id, doctors(name)")
        .neq("status", "cancelado")
        .order("scheduled_at", { ascending: true })
        .range(from, from + 999);
      if (error) throw error;
      rows.push(...((data ?? []) as unknown as Row[]));
      if (!data || data.length < 1000) break;
    }
    type Doc = { doctorId: string; name: string; agendados: number; realizadas: number; fees: number[] };
    const months = new Map<string, Map<string, Doc>>();
    for (const r of rows) {
      const month = r.scheduled_at.slice(0, 7);
      const key = r.doctor_id ?? "sem";
      const d = r.doctors;
      const name = (Array.isArray(d) ? d[0]?.name : d?.name) ?? "Sem médico";
      const mm = months.get(month) ?? new Map<string, Doc>();
      const doc = mm.get(key) ?? { doctorId: key, name, agendados: 0, realizadas: 0, fees: [] };
      doc.agendados++;
      if (r.status === "concluido") {
        doc.realizadas++;
        doc.fees.push(Number(r.doctor_fee) || 0);
      }
      mm.set(key, doc);
      months.set(month, mm);
    }
    const cents = (v: number) => Math.round(v * 100) / 100;
    const out = [...months.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, docs]) => ({
        month,
        medicos: [...docs.values()]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((d) => ({
            doctorId: d.doctorId,
            name: d.name,
            agendados: d.agendados,
            realizadas: d.realizadas,
            total: cents(d.fees.reduce((a, v) => a + v, 0)),
            valorUnico: d.fees.length > 0 && d.fees.every((v) => v === d.fees[0]) ? d.fees[0] : null,
          })),
      }));
    return NextResponse.json({ months: out });
  } catch (err) {
    return financeErrorResponse(err, "Falha ao carregar os agendamentos do DRE");
  }
}
