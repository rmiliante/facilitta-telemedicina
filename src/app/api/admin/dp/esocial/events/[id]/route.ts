import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/audit";
import { consultarLote, enviarLote, esocialConfig, resumirRetorno } from "@/lib/esocial";
import { buildLote } from "@/lib/esocial-xml";
import { masterOnly } from "@/lib/esocial-service";

const COLS = "id, employee_id, tipo, grupo, status, ambiente, event_id, params, xml, protocolo, resposta, created_at, sent_at";

/** GET — evento com o XML assinado (para conferência). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const { id } = await ctx.params;
  const { data } = await getSupabaseAdmin().from("dp_esocial_events").select(COLS).eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  return NextResponse.json({ evento: data });
}

/**
 * POST — { action: "enviar" | "consultar", confirm: true }
 * Só produção restrita (ambiente de testes do eSocial, sem valor legal).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!(await masterOnly())) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== true) return NextResponse.json({ error: "Confirmação necessária" }, { status: 400 });
  const supabase = getSupabaseAdmin();
  const { data: ev } = await supabase.from("dp_esocial_events").select(COLS).eq("id", id).maybeSingle();
  if (!ev) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 });
  const cfg = esocialConfig();
  if (cfg.ambiente !== "2") return NextResponse.json({ error: "Só é permitido em produção restrita." }, { status: 409 });
  const now = new Date().toISOString();

  try {
    if (body.action === "enviar") {
      if (ev.status !== "assinado" && ev.status !== "erro") {
        return NextResponse.json({ error: `Evento já está "${ev.status}". Gere um novo evento para reenviar.` }, { status: 409 });
      }
      const lote = buildLote(cfg.cnpj ?? "", ev.grupo, [{ id: ev.event_id, xml: ev.xml }]);
      const r = await enviarLote(cfg, lote);
      const resumo = resumirRetorno(r.body);
      const recebido = r.httpStatus === 200 && resumo.cdResposta === "201" && !!resumo.protocoloEnvio;
      const patch = {
        status: recebido ? "enviado" : "erro",
        protocolo: resumo.protocoloEnvio,
        sent_at: now,
        updated_at: now,
        resposta: { httpStatus: r.httpStatus, resumo, trecho: r.body.slice(0, 4000) },
      };
      await supabase.from("dp_esocial_events").update(patch).eq("id", id);
      await audit("staff", {
        action: "dp_esocial_enviar",
        entity: "dp_esocial_events",
        entityId: id,
        details: { tipo: ev.tipo, eventId: ev.event_id, status: patch.status, cdResposta: resumo.cdResposta, ambiente: "2" },
      });
      return NextResponse.json({ status: patch.status, resumo });
    }

    if (body.action === "consultar") {
      if (!ev.protocolo) return NextResponse.json({ error: "Este evento ainda não tem protocolo de envio." }, { status: 409 });
      const r = await consultarLote(cfg, ev.protocolo);
      const resumo = resumirRetorno(r.body);
      const meu = resumo.eventos.find((e) => e.id === ev.event_id) ?? resumo.eventos[0];
      let status: string = ev.status;
      if (resumo.cdResposta === "101") status = "enviado"; // lote ainda em processamento
      else if (meu) {
        const temErro = meu.ocorrencias.some((o) => o.tipo === "1");
        status = meu.cdResposta?.startsWith("2") && !temErro ? "processado" : "rejeitado";
      }
      await supabase
        .from("dp_esocial_events")
        .update({ status, updated_at: now, resposta: { httpStatus: r.httpStatus, resumo, trecho: r.body.slice(0, 4000) } })
        .eq("id", id);
      await audit("staff", {
        action: "dp_esocial_consultar",
        entity: "dp_esocial_events",
        entityId: id,
        details: { tipo: ev.tipo, eventId: ev.event_id, status, cdResposta: resumo.cdResposta },
      });
      return NextResponse.json({ status, resumo });
    }
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao falar com o eSocial" }, { status: 502 });
  }
}
