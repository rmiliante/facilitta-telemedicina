"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DpEmployee } from "@/lib/dp";
import { MOT_AFAST } from "@/lib/esocial-tabelas";

/* Férias e ausências — eSocial somente em ambiente de TESTES. */

interface Leave {
  id: string;
  employee_id: string;
  kind: "ferias" | "afastamento";
  cod_mot: string | null;
  start_date: string;
  end_date: string | null;
  days: number | null;
  abono: boolean;
  per_aquis_inicio: string | null;
  per_aquis_fim: string | null;
  notes: string | null;
  esocial_event_id: string | null;
  esocial_end_event_id: string | null;
}
type EvMap = Record<string, { status: string; tipo: string; protocolo: string | null }>;

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s.slice(0, 10) + "T12:00:00Z");
const addDays = (s: string, n: number) => iso(new Date(parse(s).getTime() + n * DAY));
const addYears = (s: string, n: number) => {
  const d = parse(s);
  d.setUTCFullYear(d.getUTCFullYear() + n);
  return iso(d);
};
const diff = (a: string, b: string) => Math.round((parse(a).getTime() - parse(b).getTime()) / DAY);
const fmt = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
const today = () => iso(new Date());
const btn = "rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-[#06231f] hover:bg-teal-400 disabled:opacity-50";
const btn2 = "rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50 disabled:opacity-50";
const inp = "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm";

const EV_LABEL: Record<string, { t: string; c: string }> = {
  assinado: { t: "Assinado · não enviado", c: "bg-zinc-100 text-zinc-700" },
  enviado: { t: "Enviado · aguardando", c: "bg-amber-100 text-amber-800" },
  processado: { t: "Processado", c: "bg-emerald-100 text-emerald-800" },
  rejeitado: { t: "Rejeitado", c: "bg-red-100 text-red-700" },
  erro: { t: "Erro no envio", c: "bg-red-100 text-red-700" },
};

interface Saldo {
  emp: DpEmployee;
  periodo: [string, string] | null;
  taken: number;
  limite: string | null;
  situacao: { t: string; c: string; order: number };
}

/** Período aquisitivo mais antigo com férias não totalmente gozadas. */
function saldoDe(emp: DpEmployee, leaves: Leave[]): Saldo {
  const t = today();
  const base: Saldo = { emp, periodo: null, taken: 0, limite: null, situacao: { t: "Sem data de admissão", c: "bg-zinc-100 text-zinc-600", order: 9 } };
  if (!emp.admitted_at || emp.status === "desligado") return { ...base, situacao: { t: emp.status === "desligado" ? "Desligado" : base.situacao.t, c: base.situacao.c, order: 9 } };
  const adm = emp.admitted_at.slice(0, 10);
  const mine = leaves.filter((l) => l.employee_id === emp.id && l.kind === "ferias");
  const emFerias = mine.some((l) => l.end_date && l.start_date <= t && t <= l.end_date);
  for (let n = 0; n < 40; n++) {
    const ini = addYears(adm, n);
    const fim = addDays(addYears(adm, n + 1), -1);
    const taken = mine.filter((l) => l.per_aquis_inicio === ini).reduce((s, l) => s + (l.days ?? 0) + (l.abono ? 10 : 0), 0);
    if (taken >= 30) continue;
    const limite = addYears(fim, 1).slice(0, 10);
    let s: Saldo["situacao"];
    if (emFerias) s = { t: "Em férias agora", c: "bg-sky-100 text-sky-800", order: 1 };
    else if (fim >= t) s = { t: `Em aquisição (até ${fmt(fim)})`, c: "bg-zinc-100 text-zinc-700", order: 5 };
    else if (limite < t) s = { t: `Vencida há ${-diff(limite, t)} dias`, c: "bg-red-100 text-red-700", order: 0 };
    else if (diff(limite, t) <= 60) s = { t: `Vence em ${diff(limite, t)} dias`, c: "bg-amber-100 text-amber-800", order: 2 };
    else s = { t: "No prazo", c: "bg-emerald-100 text-emerald-800", order: 4 };
    return { emp, periodo: [ini, fim], taken, limite, situacao: s };
  }
  return { ...base, situacao: { t: "Em dia", c: "bg-emerald-100 text-emerald-800", order: 6 } };
}

export default function DpFerias({ employees }: { employees: DpEmployee[] }) {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [evs, setEvs] = useState<EvMap>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fe, setFe] = useState({ emp: "", start: "", days: "30", abono: false });
  const [af, setAf] = useState({ emp: "", cod: "", start: "", end: "", notes: "" });

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/dp/leaves");
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      setLeaves(d.leaves ?? []);
      setEvs(d.eventos ?? {});
    } else setMsg(d.error ?? "Falha ao carregar");
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const ativos = useMemo(() => employees.filter((e) => e.status !== "desligado"), [employees]);
  const nome = (id: string) => employees.find((e) => e.id === id)?.full_name ?? "—";
  const saldos = useMemo(() => ativos.map((e) => saldoDe(e, leaves)).sort((a, b) => a.situacao.order - b.situacao.order || a.emp.full_name.localeCompare(b.emp.full_name)), [ativos, leaves]);
  const t = today();
  const emFerias = leaves.filter((l) => l.kind === "ferias" && l.end_date && l.start_date <= t && t <= l.end_date).length;
  const afastados = leaves.filter((l) => l.kind === "afastamento" && l.start_date <= t && (!l.end_date || t <= l.end_date)).length;
  const vencendo = saldos.filter((s) => s.situacao.order === 2).length;
  const vencidas = saldos.filter((s) => s.situacao.order === 0).length;

  const fePer = useMemo(() => saldos.find((s) => s.emp.id === fe.emp)?.periodo ?? null, [saldos, fe.emp]);

  async function post(url: string, body: unknown, method = "POST") {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok, d };
  }

  async function salvarFerias() {
    setMsg(null);
    if (!fe.emp || !fe.start) return setMsg("Escolha o colaborador e a data de início.");
    if (!fePer) return setMsg("Esse colaborador não tem período aquisitivo disponível (confira a data de admissão).");
    setBusy("fe");
    const { ok, d } = await post("/api/admin/dp/leaves", { kind: "ferias", employee_id: fe.emp, start_date: fe.start, days: Number(fe.days), abono: fe.abono, per_aquis_inicio: fePer[0], per_aquis_fim: fePer[1] });
    setBusy(null);
    if (!ok) return setMsg(d.error ?? "Falha ao salvar");
    setFe({ emp: "", start: "", days: "30", abono: false });
    await load();
  }
  async function salvarAfastamento() {
    setMsg(null);
    if (!af.emp || !af.start || !af.cod) return setMsg("Escolha o colaborador, o motivo e a data de início.");
    setBusy("af");
    const { ok, d } = await post("/api/admin/dp/leaves", { kind: "afastamento", employee_id: af.emp, cod_mot: af.cod, start_date: af.start, end_date: af.end || null, notes: af.notes });
    setBusy(null);
    if (!ok) return setMsg(d.error ?? "Falha ao salvar");
    setAf({ emp: "", cod: "", start: "", end: "", notes: "" });
    await load();
  }

  /** Gera e assina o S-2230 (início ou término) e liga o evento ao registro. NÃO envia. */
  async function gerar(l: Leave, modo: "inicio" | "fim") {
    setMsg(null);
    setBusy(l.id + modo);
    const params: Record<string, string> =
      modo === "inicio"
        ? { modo, dtIniAfast: l.start_date, codMotAfast: l.cod_mot ?? "", ...(l.kind === "ferias" ? { perAquisInicio: l.per_aquis_inicio ?? "", perAquisFim: l.per_aquis_fim ?? "" } : {}) }
        : { modo, dtTermAfast: l.end_date ?? "" };
    const r = await post("/api/admin/dp/esocial/events", { tipo: "S-2230", employee_id: l.employee_id, params });
    if (!r.ok) {
      setBusy(null);
      return setMsg(r.d.error ? `${r.d.error}${r.d.missing ? ": " + r.d.missing.join(", ") : ""}` : "Falha ao gerar");
    }
    await post(`/api/admin/dp/leaves/${l.id}`, modo === "inicio" ? { esocial_event_id: r.d.evento.id } : { esocial_end_event_id: r.d.evento.id }, "PATCH");
    setBusy(null);
    await load();
  }
  async function agir(evId: string, action: "enviar" | "consultar") {
    if (action === "enviar" && !confirm("Enviar este evento ao eSocial?\n\nSe o sistema estiver em PRODUÇÃO, o envio tem valor legal.")) return;
    setBusy(evId);
    setMsg(null);
    const r = await post(`/api/admin/dp/esocial/events/${evId}`, { action, confirm: true, confirmProducao: true });
    setBusy(null);
    if (!r.ok) setMsg(r.d.error ?? "Falha na operação");
    else if (r.d.resumo?.fault) setMsg(`eSocial: ${r.d.resumo.fault}`);
    await load();
  }
  async function encerrar(l: Leave) {
    const v = prompt("Data de término do afastamento (AAAA-MM-DD):", t);
    if (!v) return;
    const r = await post(`/api/admin/dp/leaves/${l.id}`, { end_date: v }, "PATCH");
    if (!r.ok) setMsg(r.d.error ?? "Falha ao encerrar");
    await load();
  }

  const EvCell = ({ id, label }: { id: string | null; label: string }) => {
    if (!id) return null;
    const e = evs[id];
    const st = e ? EV_LABEL[e.status] ?? { t: e.status, c: "bg-zinc-100 text-zinc-700" } : { t: "—", c: "" };
    return (
      <div className="mb-1 flex flex-wrap items-center gap-1">
        <span className="text-[11px] text-zinc-500">{label}</span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${st.c}`}>{st.t}</span>
        {e && (e.status === "assinado" || e.status === "erro") && <button className={btn2} disabled={busy === id} onClick={() => agir(id, "enviar")}>Enviar (teste)</button>}
        {e && e.status === "enviado" && <button className={btn2} disabled={busy === id} onClick={() => agir(id, "consultar")}>Consultar resultado</button>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
        <b>eSocial.</b> Em ambiente de TESTES os eventos não têm valor legal; em PRODUÇÃO têm. Nada é enviado sem o seu clique em “Enviar”.
      </p>
      {msg && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{msg}</p>}

      <div className="grid gap-3 sm:grid-cols-4">
        {[["Em férias hoje", emFerias, ""], ["Afastados hoje", afastados, ""], ["Férias vencendo em 60 dias", vencendo, "text-amber-700"], ["Férias vencidas (risco de pagamento em dobro)", vencidas, "text-red-700"]].map(([l, n, c]) => (
          <div key={String(l)} className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className={`text-2xl font-bold ${c}`}>{n}</div>
            <div className="text-xs text-zinc-500">{l}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#0b1f3a]">Saldo de férias por colaborador</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="p-1.5">Colaborador</th><th className="p-1.5">Admissão</th><th className="p-1.5">Período aquisitivo</th><th className="p-1.5">Gozados</th><th className="p-1.5">Limite para gozar</th><th className="p-1.5">Situação</th>
              </tr>
            </thead>
            <tbody>
              {saldos.map((s) => (
                <tr key={s.emp.id} className="border-t border-zinc-100">
                  <td className="p-1.5 font-medium">{s.emp.full_name}</td>
                  <td className="p-1.5">{fmt(s.emp.admitted_at)}</td>
                  <td className="p-1.5">{s.periodo ? `${fmt(s.periodo[0])} – ${fmt(s.periodo[1])}` : "—"}</td>
                  <td className="p-1.5">{s.periodo ? `${s.taken}/30` : "—"}</td>
                  <td className="p-1.5">{fmt(s.limite)}</td>
                  <td className="p-1.5"><span className={`rounded-full px-2 py-0.5 ${s.situacao.c}`}>{s.situacao.t}</span></td>
                </tr>
              ))}
              {!saldos.length && <tr><td colSpan={6} className="p-3 text-zinc-400">Nenhum colaborador ativo.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-[#0b1f3a]">Programar férias</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs"><span className="mb-1 block font-medium text-zinc-600">Colaborador</span>
              <select className={inp} value={fe.emp} onChange={(e) => setFe({ ...fe, emp: e.target.value })}>
                <option value="">Selecione…</option>
                {ativos.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select></label>
            <label className="block text-xs"><span className="mb-1 block font-medium text-zinc-600">Início</span>
              <input type="date" className={inp} value={fe.start} onChange={(e) => setFe({ ...fe, start: e.target.value })} /></label>
            <label className="block text-xs"><span className="mb-1 block font-medium text-zinc-600">Dias de gozo</span>
              <input type="number" min={5} max={30} className={inp} value={fe.days} onChange={(e) => setFe({ ...fe, days: e.target.value })} /></label>
            <label className="flex items-end gap-2 pb-2 text-xs"><input type="checkbox" checked={fe.abono} onChange={(e) => setFe({ ...fe, abono: e.target.checked, days: e.target.checked && Number(fe.days) > 20 ? "20" : fe.days })} /> Abono pecuniário (vender 10 dias)</label>
          </div>
          {fe.emp && <p className="mt-2 text-xs text-zinc-500">Período aquisitivo: {fePer ? `${fmt(fePer[0])} a ${fmt(fePer[1])}` : "indisponível"}</p>}
          <p className="mt-2 text-[11px] text-zinc-500">Regras da CLT: mínimo de 14 dias em um dos períodos, nenhum período menor que 5 dias, e o início não pode cair nos 2 dias anteriores a feriado ou dia de folga semanal.</p>
          <button className={`${btn} mt-3`} disabled={busy === "fe"} onClick={salvarFerias}>{busy === "fe" ? "Salvando…" : "Salvar férias"}</button>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-[#0b1f3a]">Registrar ausência / afastamento</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs"><span className="mb-1 block font-medium text-zinc-600">Colaborador</span>
              <select className={inp} value={af.emp} onChange={(e) => setAf({ ...af, emp: e.target.value })}>
                <option value="">Selecione…</option>
                {ativos.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select></label>
            <label className="block text-xs"><span className="mb-1 block font-medium text-zinc-600">Motivo (Tabela 18)</span>
              <select className={inp} value={af.cod} onChange={(e) => setAf({ ...af, cod: e.target.value })}>
                <option value="">Selecione…</option>
                {MOT_AFAST.map(([c, d]) => <option key={c} value={c}>{c} – {d}</option>)}
              </select></label>
            <label className="block text-xs"><span className="mb-1 block font-medium text-zinc-600">Início</span>
              <input type="date" className={inp} value={af.start} onChange={(e) => setAf({ ...af, start: e.target.value })} /></label>
            <label className="block text-xs"><span className="mb-1 block font-medium text-zinc-600">Fim previsto (opcional)</span>
              <input type="date" className={inp} value={af.end} onChange={(e) => setAf({ ...af, end: e.target.value })} /></label>
            <label className="block text-xs sm:col-span-2"><span className="mb-1 block font-medium text-zinc-600">Observação</span>
              <input className={inp} value={af.notes} onChange={(e) => setAf({ ...af, notes: e.target.value })} /></label>
          </div>
          <button className={`${btn} mt-3`} disabled={busy === "af"} onClick={salvarAfastamento}>{busy === "af" ? "Salvando…" : "Registrar"}</button>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#0b1f3a]">Histórico</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-zinc-500"><th className="p-1.5">Colaborador</th><th className="p-1.5">Tipo</th><th className="p-1.5">Período</th><th className="p-1.5">eSocial (S-2230)</th></tr></thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id} className="border-t border-zinc-100 align-top">
                  <td className="p-1.5 font-medium">{nome(l.employee_id)}</td>
                  <td className="p-1.5">{l.kind === "ferias" ? `Férias${l.abono ? " (com abono)" : ""}` : `Afastamento ${l.cod_mot ?? ""}`}{l.notes ? <div className="text-zinc-500">{l.notes}</div> : null}</td>
                  <td className="p-1.5">{fmt(l.start_date)} – {l.end_date ? fmt(l.end_date) : "em aberto"}{l.days ? ` (${l.days} dias)` : ""}</td>
                  <td className="p-1.5">
                    <EvCell id={l.esocial_event_id} label="Início:" />
                    {!l.esocial_event_id && <button className={btn2} disabled={busy === l.id + "inicio"} onClick={() => gerar(l, "inicio")}>Gerar S-2230 de início</button>}
                    {l.kind === "afastamento" && !l.end_date && <button className={`${btn2} ml-1`} onClick={() => encerrar(l)}>Encerrar afastamento</button>}
                    <EvCell id={l.esocial_end_event_id} label="Término:" />
                    {l.kind === "afastamento" && l.end_date && l.esocial_event_id && !l.esocial_end_event_id && <button className={btn2} disabled={busy === l.id + "fim"} onClick={() => gerar(l, "fim")}>Gerar S-2230 de término</button>}
                  </td>
                </tr>
              ))}
              {!leaves.length && <tr><td colSpan={4} className="p-3 text-zinc-400">Nenhum registro ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
