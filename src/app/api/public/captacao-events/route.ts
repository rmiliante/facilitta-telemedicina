import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

const EVENTS = ["view", "start"] as const;

function clip(v: unknown, max = 200): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s === "" ? null : s;
}

/**
 * POST /api/public/captacao-events — registra visita ("view") e início de
 * preenchimento ("start") do formulário de captação. O envio ("submit") é
 * registrado no próprio servidor, em /api/public/doctor-applications.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ ok: true });

  const sessionId = clip(body.sessionId, 64);
  const event = clip(body.event, 20);
  if (!sessionId || !event || !(EVENTS as readonly string[]).includes(event)) {
    return NextResponse.json({ ok: true });
  }

  const supabase = getSupabaseAdmin();

  // Evita repetição (recarregar a página, vários cliques): 1 evento de cada tipo por sessão.
  const { count } = await supabase
    .from("captacao_events")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId)
    .eq("event", event);
  if ((count ?? 0) > 0) return NextResponse.json({ ok: true });

  const device = clip(body.device, 20);
  await supabase.from("captacao_events").insert({
    session_id: sessionId,
    event,
    utm_source: clip(body.utmSource),
    utm_medium: clip(body.utmMedium),
    utm_campaign: clip(body.utmCampaign),
    utm_content: clip(body.utmContent),
    utm_term: clip(body.utmTerm),
    referrer: clip(body.referrer, 300),
    device: device && ["celular", "tablet", "computador"].includes(device) ? device : null,
  });

  return NextResponse.json({ ok: true });
}
