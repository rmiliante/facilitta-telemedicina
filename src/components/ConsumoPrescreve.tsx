"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

/** Dashboard > Médicos: consumo da Prescreve (franquia de documentos e créditos de assinatura). */

interface Linha {
  name: string;
  exame: number;
  receita: number;
  atestado: number;
  apac: number;
  api: number;
  assinatura: number;
}
interface Consumo {
  mes: string;
  atual: boolean;
  diasMes: number;
  diaAtual: number;
  diasRestantes: number;
  franquia: number | null;
  consumidosApi: number;
  faltaConsumir: number | null;
  pctUsado: number | null;
  ritmoDia: number;
  projecaoMes: number;
  semPdf: number;
  assinaturaDigital: number;
  creditos: number | null;
  total: number;
  medicos: Linha[];
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const nomeMes = (m: string) => `${MESES[Number(m.slice(5)) - 1]}/${m.slice(0, 4)}`;

function ultimosMeses(n: number) {
  const base = new Date(Date.now() - 3 * 3600_000);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    return d.toISOString().slice(0, 7);
  });
}

function Tile({ label, children, hint, tone }: { label: ReactNode; children: ReactNode; hint?: ReactNode; tone?: "teal" }) {
  return (
    <div className={`rounded-lg border p-4 ${tone === "teal" ? "border-teal-200 bg-teal-50" : "border-zinc-200 bg-white"}`}>
      <p className={`text-xs font-medium ${tone === "teal" ? "text-teal-700" : "text-zinc-500"}`}>{label}</p>
      <div className="mt-1 text-2xl font-semibold text-brand-navy">{children}</div>
      {hint && <div className="mt-0.5 text-[11px] text-zinc-500">{hint}</div>}
    </div>
  );
}

export default function ConsumoPrescreve() {
  const [mes, setMes] = useState(() => ultimosMeses(1)[0]);
  const [data, setData] = useState<Consumo | null>(null);
  const [error, setError] = useState(false);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch(`/api/admin/consumo-prescreve?mes=${mes}`);
      if (!res.ok) throw new Error();
      setData((await res.json()) as Consumo);
    } catch {
      setError(true);
    }
  }, [mes]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function salvar() {
    setSalvando(true);
    const res = await fetch("/api/admin/consumo-prescreve", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ franquia: valor.trim() === "" ? null : Number(valor) }),
    }).catch(() => null);
    setSalvando(false);
    if (res?.ok) {
      setEditando(false);
      load();
    }
  }

  if (error) return <p className="text-xs text-red-600">Falha ao carregar o consumo da Prescreve.</p>;
  if (!data) return <p className="text-xs text-zinc-400">Carregando consumo da Prescreve...</p>;

  const usado = data.pctUsado ?? 0;
  const estoura = data.franquia != null && data.projecaoMes > data.franquia;
  const soma = (k: "exame" | "receita" | "atestado" | "apac") => data.medicos.reduce((t, l) => t + l[k], 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Consumo da Prescreve</p>
        <select value={mes} onChange={(e) => setMes(e.target.value)} className="rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs">
          {ultimosMeses(6).map((m) => (
            <option key={m} value={m}>
              {nomeMes(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Documentos pela API (franquia)" hint="exames, receitas e atestados emitidos pela API de Prescrições">
          {data.consumidosApi}
        </Tile>
        <Tile
          label={
            <span>
              Franquia mensal{" "}
              <button
                type="button"
                className="text-teal-700 underline"
                onClick={() => {
                  setValor(data.franquia != null ? String(data.franquia) : "");
                  setEditando(!editando);
                }}
              >
                {data.franquia != null ? "editar" : "informar"}
              </button>
            </span>
          }
          hint={data.franquia != null ? "documentos por mês contratados" : "informe o contratado para calcular o que falta"}
        >
          {editando ? (
            <span className="flex items-center gap-1.5">
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                className="w-24 rounded-md border border-zinc-300 px-2 py-1 text-base"
                placeholder="ex.: 500"
              />
              <button type="button" disabled={salvando} onClick={salvar} className="rounded-md bg-brand-navy px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">
                Salvar
              </button>
            </span>
          ) : data.franquia != null ? (
            data.franquia
          ) : (
            "—"
          )}
        </Tile>
        <Tile
          tone="teal"
          label="Falta consumir"
          hint={
            data.franquia != null ? (
              <>
                {usado}% usado
                {data.atual && ` · ${data.diasRestantes} dias restantes · ritmo de ${String(data.ritmoDia).replace(".", ",")}/dia`}
                {estoura && <span className="font-semibold text-amber-700"> · no ritmo atual passa da franquia (projeção {data.projecaoMes})</span>}
              </>
            ) : (
              "depende da franquia informada"
            )
          }
        >
          {data.faltaConsumir ?? "—"}
          {data.franquia != null && (
            <div className="mt-1.5 h-2 rounded-full bg-zinc-200">
              <div className={`h-2 rounded-full ${estoura ? "bg-amber-500" : "bg-teal-600"}`} style={{ width: `${Math.min(100, usado)}%` }} />
            </div>
          )}
        </Tile>
        <Tile label="Créditos de assinatura (APAC)" hint={`saldo atual na Prescreve · ${data.assinaturaDigital} usados no mês`}>
          {data.creditos ?? "—"}
        </Tile>
      </div>

      {data.semPdf > 0 && (
        <p className="text-[11px] text-amber-700">
          {data.semPdf} documento(s) emitido(s) no mês ainda sem o PDF salvo (contam no consumo). Eles são recuperados quando o médico entra na Prescreve.
        </p>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Consumo por médico · {nomeMes(data.mes)}</h3>
        {data.medicos.length === 0 ? (
          <p className="text-xs text-zinc-400">Nenhum documento no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="text-[10.5px] uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="pb-2 pr-3 font-semibold">Médico</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Exames</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Receitas</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Atestados</th>
                  <th className="pb-2 pr-3 text-right font-semibold">APAC</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Total</th>
                  <th className="pb-2 text-right font-semibold">% da franquia</th>
                </tr>
              </thead>
              <tbody>
                {data.medicos.map((l) => (
                  <tr key={l.name} className="border-t border-zinc-100">
                    <td className="py-1.5 pr-3 text-zinc-700">{l.name}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{l.exame}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{l.receita}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{l.atestado}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{l.apac}</td>
                    <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">{l.api + l.assinatura}</td>
                    <td className="py-1.5 text-right tabular-nums">{data.franquia ? `${Math.round((l.api / data.franquia) * 100)}%` : "—"}</td>
                  </tr>
                ))}
                <tr className="border-t border-zinc-200 bg-zinc-50 font-semibold">
                  <td className="py-1.5 pr-3">Total</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{soma("exame")}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{soma("receita")}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{soma("atestado")}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{soma("apac")}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{data.total}</td>
                  <td className="py-1.5 text-right tabular-nums">{data.pctUsado != null ? `${data.pctUsado}%` : "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[10px] text-zinc-400">
          A % da franquia conta só os documentos emitidos pela API de Prescrições. APAC e documentos do fluxo antigo usam os créditos de assinatura.
        </p>
      </div>
    </div>
  );
}
