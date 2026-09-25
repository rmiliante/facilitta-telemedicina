import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { APPLICATION_STATUSES, signApplicationPhoto } from "@/lib/doctorApplications";

/**
 * GET /api/admin/doctor-applications — lista candidaturas do
 * formulário público, com os filtros da tela de captação.
 * Query params (todos opcionais): q, specialty, city, state, shift,
 * status, minPrice, maxPrice.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
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

  const applications = await Promise.all(
    (data ?? []).map(async (app) => ({
      ...app,
      photo_url: await signApplicationPhoto(app.photo_path),
    }))
  );

  return NextResponse.json({ applications });
}
