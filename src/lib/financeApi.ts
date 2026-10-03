import { NextResponse } from "next/server";
import { FinanceError } from "@/lib/finance";

/** Resposta de erro padrão das rotas do financeiro. */
export function financeErrorResponse(err: unknown, fallback: string) {
  if (err instanceof FinanceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(`${fallback}:`, err);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
