import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sanitizeSearch } from "@/lib/format";
import { APPLICATION_STATUSES, signApplicationPhoto } from "@/lib/doctorApplications";

interface LinkedDoctor {
  id: string;
  /** CPF, CRM e UF preenchidos (necessários para assinar receitas). */
  complete: boolean;
  /** Já pediu/ativou alguma sessão de assinatura. */
  signing: boolean;
  /** Já concluiu ao menos uma consulta. */
  attended: boolean;
}

/**
 * GET /api/admin/doctor-applications — lista candidaturas do
 * formulário público, com os filtros da tela de captação.
 * Query params (todos opcionais): q, specialty, city, state, shift,
 * status, minPrice, maxPrice.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = sanitizeSearch(searchParams.get("q") ?? "");
  const specialty = searchParams.get("specialty")?.trim();
  const city = searchParams.get("city")?.trim();
  const state = searchParams.get("state")?.trim();
  const shift = searchParams.get("shift")?.trim();
  const status = searchParams.get("status")?.trim();
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("doctor_applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`name.ilike.%${q}%,crm.ilike.%${q}%`);
  }
  if (specialty) query = query.eq("specialty", specialty);
  if (city) query = query.ilike("city", `%${city}%`);
  if (state) query = query.eq("state", state);
  if (shift) query = query.contains("available_shifts", [shift]);
  if (status && (APPLICATION_STATUSES as readonly string[]).includes(status)) {
    query = query.eq("status", status);
  }
  if (minPrice) query = query.gte("consult_price", Number(minPrice));
  if (maxPrice) query = query.lte("consult_price", Number(maxPrice));

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar candidaturas:", error);
    return NextResponse.json({ error: "Falha ao buscar candidaturas" }, { status: 500 });
  }

  // Médico já criado com o mesmo e-mail: mostra em que ponto da ativação ele está.
  const doctorByEmail = new Map<string, LinkedDoctor>();
  const emails = Array.from(new Set((data ?? []).map((a) => String(a.email).trim().toLowerCase())));
  if (emails.length > 0) {
    const { data: docs } = await supabase
      .from("doctors")
      .select("id, email, cpf, crm, crm_uf, prescreve_session_id, prescreve_session_status, prescreve_session_expires_at")
      .in("email", emails);
    const ids = (docs ?? []).map((d) => d.id as string);
    const withDone = new Set<string>();
    if (ids.length > 0) {
      const { data: done } = await supabase
        .from("appointments")
        .select("doctor_id")
        .eq("status", "concluido")
        .in("doctor_id", ids);
      for (const r of done ?? []) withDone.add(r.doctor_id as string);
    }
    for (const d of docs ?? []) {
      const sessionOk =
        d.prescreve_session_status === "active" ||
        d.prescreve_session_status === "awaiting_approval" ||
        !!d.prescreve_session_id;
      doctorByEmail.set(String(d.email).trim().toLowerCase(), {
        id: d.id as string,
        complete: String(d.cpf ?? "").replace(/\D/g, "").length === 11 && !!d.crm && !!d.crm_uf,
        signing: sessionOk,
        attended: withDone.has(d.id as string),
      });
    }
  }

  const applications = await Promise.all(
    (data ?? []).map(async (app) => ({
      ...app,
      photo_url: await signApplicationPhoto(app.photo_path),
      doctor: doctorByEmail.get(String(app.email).trim().toLowerCase()) ?? null,
    }))
  );

  return NextResponse.json({ applications });
}
