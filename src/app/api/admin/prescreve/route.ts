import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { currentStaffRole } from "@/lib/auth";
import { prescricoesAtivo, statusCertificado } from "@/lib/prescrevePrescricoes";

/** GET /api/admin/prescreve — visão do Master sobre receitas controladas (Prescreve). */
export async function GET() {
  if ((await currentStaffRole()) !== "master") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  if (!prescricoesAtivo()) return NextResponse.json({ ativo: false });

  const supabase = getSupabaseAdmin();
  const { data: doctors } = await supabase
    .from("doctors")
    .select("id, name, crm, crm_uf, active, prescreve_uuid, prescreve_validado_em")
    .eq("active", true)
    .order("name", { ascending: true });
  const { data: docs } = await supabase
    .from("prescreve_documentos")
    .select("id, doctor_id, paciente_nome, tipo_controle, numero_sncr, status, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  const now = new Date();
  // Início do mês em horário de Brasília (UTC-3).
  const inicioMes = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 3)).getTime();
  const list = docs || [];
  const nomePorId = new Map<string, string>((doctors || []).map((d): [string, string] => [d.id as string, d.name as string]));

  const medicos = await Promise.all(
    (doctors || []).map(async (d) => {
      let conectado: boolean | null = null;
      if (d.prescreve_uuid) {
        try {
          const st = await statusCertificado(d.prescreve_uuid as string);
          conectado = st.connected === true || st.status === "connected" || st.status === "active";
        } catch {
          conectado = null;
        }
      }
      const meus = list.filter((x) => x.doctor_id === d.id);
      return {
        id: d.id as string,
        name: d.name as string,
        crm: d.crm ? String(d.crm) + (d.crm_uf ? "/" + String(d.crm_uf) : "") : null,
        vinculado: !!d.prescreve_uuid,
        validadoEm: (d.prescreve_validado_em as string | null) || null,
        conectado,
        mes: meus.filter((x) => new Date(x.created_at as string).getTime() >= inicioMes).length,
        total: meus.length,
      };
    })
  );

  const recentes = list.slice(0, 10).map((x) => ({
    id: x.id as string,
    medico: nomePorId.get(x.doctor_id as string) || "—",
    paciente: (x.paciente_nome as string) || "—",
    tipo: (x.tipo_controle as string) || "—",
    numero: (x.numero_sncr as string | null) || null,
    status: (x.status as string) || "—",
    quando: x.created_at as string,
  }));

  return NextResponse.json({
    ativo: true,
    medicos,
    recentes,
    emitidosNoMes: list.filter((x) => new Date(x.created_at as string).getTime() >= inicioMes).length,
    limiteMensal: 500,
  });
}
