"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

/** Dashboard > Prescrições: o que já foi prescrito (receitas, exames, atestados, APAC). */

interface Item {
  name: string;
  count: number;
}
interface Stats {
  total: number;
  porTipo: Record<string, number>;
  assinadosPct: number | null;
  docsPorConsulta: number | null;
  semanas: ({ week: string } & Record<string, number | string>)[];
  tiposReceita: { name: string; key: string; count: number }[];
  medicos: ({ name: string; total: number } & Record<string, number | string>)[];
  medicamentos: Item[];
  exames: Item[];
  ultimas: { at: string; patient: string; author: string; kind: string; tipoReceita: string | null; itens: number | null; signed: boolean }[];
  filtros: { medicos: string[] };
  leitura: { lidos: number; receitasSemLeitura: number };
}

const KIND_LABEL: Record<string, string> = { receita: "Receita", exame: "Pedido de exame", atestado: "Atestado", apac: "Laudo APAC" };
const KIND_COLOR: Record<string, string> = { exame: "bg-brand-teal", receita: "bg-brand-navy", atestado: "bg-amber-400", apac: "bg-indigo-400" };
const TIPO_COLOR: Record<string, string> = {
  simples: "bg-brand-teal",
  controle_especial: "bg-amber-500",
  antimicrobiano: "bg-indigo-500",
  glp1: "bg-rose-500",
  notificacao: "bg-zinc-500",
};
const fieldCls =
  "rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-800 outline-none focus:border-brand-teal-dark";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function br(day: string) {
  return day.split("-").reverse().join("/");
}

function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-brand-navy">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-zinc-500">{hint}</p>}
    </div>
  );
}
function Card({ title, children, extra }: { title: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        {title}
        {extra}
      </h3>
      {children}
    </div>
  );
}
function Bars({ items, colors }: { items: Item[]; colors?: (i: Item, idx: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (items.length === 0) return <p className="text-xs text-zinc-400">Sem dados no período.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((i, idx) => (
        <li key={i.name} className="flex items-center gap-2 text-xs">
          <span className="w-40 shrink-0 truncate text-zinc-700" title={i.name}>
            {i.name}
          </span>
          <span className="h-2.5 flex-1 rounded-full bg-zinc-100">
            <span
              className={`block h-2.5 rounded-full ${colors ? colors(i, idx) : "bg-brand-teal"}`}
              style={{ width: `${Math.max(3, (i.count / max) * 100)}%` }}
            />
          </span>
          <span className="w-8 text-right tabular-nums text-zinc-600">{i.count}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PrescricoesDashboard() {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [from, setFrom] = useState(() => ymd(new Date(Date.now() - 30 * 86400_000)));
  const [to, setTo] = useState("");
  const [medico, setMedico] = useState("");
  const [tipo, setTipo] = useState("");
  const [lendo, setLendo] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const qs = new URLSearchParams({ from, to, medico, tipo });
      const res = await fetch(`/api/admin/dashboard-prescricoes?${qs}`);
      if (!res.ok) throw new Error();
      setData((await res.json()) as Stats);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [from, to, medico, tipo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function lerPdfs() {
    setLendo("Lendo os PDFs antigos...");
    let lidos = 0;
    for (let i = 0; i < 40; i++) {
      const res = await fetch("/api/admin/prescricoes/backfill?limit=25", { method: "POST" });
      if (!res.ok) {
        setLendo("Falha ao ler os PDFs. Tente de novo.");
        return;
      }
      const r = (await res.json()) as { lidos: number; restantes: number };
      lidos += r.lidos;
      setLendo(`Lendo os PDFs antigos... ${lidos} lidos, ${r.restantes} restantes`);
      if (r.restantes === 0) break;
    }
    setLendo(null);
    load();
  }

  const maxSemana = Math.max(1, ...(data?.semanas ?? []).map((s) => ["exame", "receita", "atestado", "apac"].reduce((t, k) => t + Number(s[k] ?? 0), 0)));
  const pct = (n: number) => (data && data.total ? `${Math.round((n / data.total) * 100)}% do total` : undefined);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-[11px] text-zinc-500">
          De
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${fieldCls} mt-0.5 block`} />
        </label>
        <label className="text-[11px] text-zinc-500">
          Até
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${fieldCls} mt-0.5 block`} />
        </label>
        <label className="text-[11px] text-zinc-500">
          Médico
          <select value={medico} onChange={(e) => setMedico(e.target.value)} className={`${fieldCls} mt-0.5 block`}>
            <option value="">Todos</option>
            {data?.filtros.medicos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="text-[11px] text-zinc-500">
          Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${fieldCls} mt-0.5 block`}>
            <option value="">Todos</option>
            {Object.entries(KIND_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setFrom("");
            setTo("");
            setMedico("");
            setTipo("");
          }}
          className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50"
        >
          Todo o histórico
        </button>
      </div>

      {loading && !data && <p className="text-xs text-zinc-400">Carregando prescrições...</p>}
      {error && <p className="text-xs text-red-600">Falha ao carregar os dados de prescrições.</p>}

      {data && (
        <>
          {data.leitura.receitasSemLeitura > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span>
                {data.leitura.receitasSemLeitura} receita(s) ainda sem os medicamentos lidos do PDF (tipo de receita e mais prescritos ficam incompletos).
              </span>
              <button
                type="button"
                disabled={!!lendo}
                onClick={lerPdfs}
                className="rounded-md bg-brand-navy px-3 py-1 font-semibold text-white disabled:opacity-60"
              >
                {lendo ?? "Ler PDFs antigos"}
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Documentos emitidos" value={data.total} />
            <Kpi label="Receitas" value={data.porTipo.receita ?? 0} hint={pct(data.porTipo.receita ?? 0)} />
            <Kpi label="Pedidos de exame" value={data.porTipo.exame ?? 0} hint={pct(data.porTipo.exame ?? 0)} />
            <Kpi label="Atestados" value={data.porTipo.atestado ?? 0} hint={pct(data.porTipo.atestado ?? 0)} />
            <Kpi label="Laudos APAC" value={data.porTipo.apac ?? 0} hint={pct(data.porTipo.apac ?? 0)} />
            <Kpi label="Assinados ICP-Brasil" value={data.assinadosPct === null ? "—" : `${data.assinadosPct}%`} hint={data.docsPorConsulta ? `${data.docsPorConsulta} documentos por consulta` : undefined} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card title="Documentos por semana">
                {data.semanas.length === 0 ? (
                  <p className="text-xs text-zinc-400">Sem dados no período.</p>
                ) : (
                  <>
                    <div className="flex h-44 items-end gap-2">
                      {data.semanas.map((s) => (
                        <div key={s.week} className="flex flex-1 flex-col items-center gap-1">
                          <div className="flex w-full flex-col-reverse overflow-hidden rounded-t" style={{ height: `${(["exame", "receita", "atestado", "apac"].reduce((t, k) => t + Number(s[k] ?? 0), 0) / maxSemana) * 100}%` }}>
                            {["exame", "receita", "atestado", "apac"].map((k) => (
                              <div key={k} className={KIND_COLOR[k]} style={{ flexGrow: Number(s[k] ?? 0), flexBasis: 0 }} title={`${KIND_LABEL[k]}: ${s[k]}`} />
                            ))}
                          </div>
                          <span className="text-[10px] text-zinc-500">{br(String(s.week)).slice(0, 5)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-zinc-600">
                      {["exame", "receita", "atestado", "apac"].map((k) => (
                        <span key={k} className="flex items-center gap-1">
                          <span className={`h-2.5 w-2.5 rounded-sm ${KIND_COLOR[k]}`} />
                          {KIND_LABEL[k]}
                        </span>
                      ))}
                      <span className="text-zinc-400">· semanas começando na segunda-feira</span>
                    </div>
                  </>
                )}
              </Card>
            </div>
            <Card title="Tipo de receita">
              <Bars items={data.tiposReceita} colors={(i) => TIPO_COLOR[data.tiposReceita.find((t) => t.name === i.name)?.key ?? "simples"]} />
              <p className="mt-2 text-[11px] text-zinc-400">Receitas com o PDF já lido.</p>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Por médico">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-zinc-500">
                    <th className="pb-1 font-medium">Médico</th>
                    <th className="pb-1 text-right font-medium">Rec.</th>
                    <th className="pb-1 text-right font-medium">Exa.</th>
                    <th className="pb-1 text-right font-medium">Atest.</th>
                    <th className="pb-1 text-right font-medium">APAC</th>
                  </tr>
                </thead>
                <tbody>
                  {data.medicos.map((m) => (
                    <tr key={m.name} className="border-t border-zinc-100">
                      <td className="py-1 text-zinc-700">{m.name}</td>
                      <td className="py-1 text-right tabular-nums">{m.receita}</td>
                      <td className="py-1 text-right tabular-nums">{m.exame}</td>
                      <td className="py-1 text-right tabular-nums">{m.atestado}</td>
                      <td className="py-1 text-right tabular-nums">{m.apac}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card title="Medicamentos mais prescritos">
              <Bars items={data.medicamentos} colors={() => "bg-brand-navy"} />
            </Card>
            <Card title="Exames mais pedidos">
              <Bars items={data.exames} />
            </Card>
          </div>

          <Card title="Últimas prescrições">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-zinc-500">
                    <th className="pb-1 font-medium">Data</th>
                    <th className="pb-1 font-medium">Paciente</th>
                    <th className="pb-1 font-medium">Médico</th>
                    <th className="pb-1 font-medium">Tipo</th>
                    <th className="pb-1 text-right font-medium">Itens</th>
                    <th className="pb-1 font-medium">Assinatura</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ultimas.map((u, i) => (
                    <tr key={i} className="border-t border-zinc-100">
                      <td className="whitespace-nowrap py-1 text-zinc-600">{new Date(u.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="py-1 text-zinc-700">{u.patient}</td>
                      <td className="py-1 text-zinc-700">{u.author}</td>
                      <td className="py-1 text-zinc-700">{KIND_LABEL[u.kind]}{u.tipoReceita ? ` · ${u.tipoReceita}` : ""}</td>
                      <td className="py-1 text-right tabular-nums text-zinc-600">{u.itens ?? "—"}</td>
                      <td className="py-1">{u.signed ? "✓ ICP-Brasil" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
