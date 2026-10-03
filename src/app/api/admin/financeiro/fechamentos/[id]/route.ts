import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { isDayKey } from "@/lib/format";
import {
  getPayout,
  markPaid,
  PAYMENT_METHODS,
  payoutAppointments,
  withFileUrls,
  reopenPayout,
  unmarkPaid,
  type PaymentMethod,
} from "@/lib/finance";
import { financeErrorResponse } from "@/lib/financeApi";

type Params = { params: Promise<{ id: string }> };

/** GET — detalhes do fechamento: consultas incluídas e link do comprovante. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const payout = await getPayout(id);
    if (!payout) return NextResponse.json({ error: "Fechamento não encontrado" }, { status: 404 });
    const [appointments, withUrls] = await Promise.all([payoutAppointments(id), withFileUrls(payout)]);
    return NextResponse.json({ payout: withUrls, appointments });
  } catch (err) {
    return financeErrorResponse(err, "Falha ao carregar o fechamento");
  }
}

/**
 * PATCH — { action: "pagar", paidAt, method, notes } registra o pagamento;
 * { action: "desfazer_pagamento" } volta para "a pagar".
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    if (body?.action === "desfazer_pagamento") {
      return NextResponse.json({ payout: await unmarkPaid(id) });
    }
    if (body?.action !== "pagar") return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    if (!isDayKey(body.paidAt)) return NextResponse.json({ error: "Informe a data do pagamento" }, { status: 400 });
    if (!(PAYMENT_METHODS as readonly string[]).includes(body.method)) {
      return NextResponse.json({ error: "Forma de pagamento inválida" }, { status: 400 });
    }
    const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 500) : null;
    const staff = await getStaffSession();
    const payout = await markPaid(id, { paidAt: body.paidAt, method: body.method as PaymentMethod, notes }, staff?.name ?? "Administração");
    return NextResponse.json({ payout });
  } catch (err) {
    return financeErrorResponse(err, "Falha ao registrar o pagamento");
  }
}

/** DELETE — reabre (desfaz) um fechamento ainda não pago. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await reopenPayout(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return financeErrorResponse(err, "Falha ao reabrir o fechamento");
  }
}
