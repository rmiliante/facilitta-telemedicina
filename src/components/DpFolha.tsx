"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { DpEmployee } from "@/lib/dp";

/* Folha e custos — Regularização / passivo + Guias e vencimentos.
   ESTIMATIVAS para apoio ao contador. Nada é enviado ao governo por esta tela. */

interface Comissao { employee_id: string; competencia: string; valor: number }
interface Guia { competencia: string; tipo: string; valor: number | null; status: string; codigo: string | null; pago_em: string | null; contador_nome: string | null; contador_em: string | null; notes: string | null }

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const labelComp = (c: string) => `${MESES[Number(c.slice(5, 7)) - 1]}/${c.slice(0, 4)}`;
const inp = "rounded-md border border-zinc-300 px-2 py-1 text-sm";
const btn = "rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-[#06231f] hover:bg-teal-400 disabled:opacity-50";
const btn2 = "rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50 disabled:opacity-50";

/* Tabela INSS empregado (progressiva) — CONFERIR com o contador a cada ano. */
const INSS_FAIXAS: [number, number][] = [[1621.0, 0.075], [2902.84, 0.09], [4354.27, 0.12], [8475.55, 0.14]];
function inssEmpregado(base: number): number {
  let prev = 0, tot = 0;
  for (const [teto, aliq] of INSS_FAIXAS) {
    if (base > prev) tot += (Math.min(base, teto) - prev) * aliq;
    prev = teto;
  }
  return r2(tot);
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const ymOf = (d: string) => d.slice(0, 7);
const daysIn = (ym: string) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
function nextYm(ym: string) {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

interface Mes { ym: string; dias: number; salario: number; comissao: number; base: number; fgts: number; inss: number; aberto: boolean }

/** Meses de vínculo (admissão → hoje/desligamento) com salário proporcional, comissão informada, FGTS 8% e INSS. */
function calcMeses(e: DpEmployee, comis: Record<string, number>, fgtsPct: number): Mes[] {
  if (!e.admitted_at || !e.salary) return [];
  const hoje = todayIso();
  const fim = e.terminated_at && e.terminated_at < hoje ? e.terminated_at : hoje;
  const adm = e.admitted_at.slice(0, 10);
  if (adm > fim) return [];
  const out: Mes[] = [];
  for (let ym = ymOf(adm); ym <= ymOf(fim); ym = nextYm(ym)) {
    const dim = daysIn(ym);
    const d1 = ym === ymOf(adm) ? Number(adm.slice(8, 10)) : 1;
    const d2 = ym === ymOf(fim) ? Number(fim.slice(8, 10)) : dim;
    const dias = d2 - d1 + 1;
    const salario = r2((e.salary * dias) / dim);
    const comissao = comis[ym] ?? 0;
    const base = r2(salario + comissao);
    out.push({ ym, dias, salario, comissao, base, fgts: r2(base * fgtsPct), inss: inssEmpregado(base), aberto: ym === ymOf(hoje) });
  }
  return out;
}

async function salvar(body: Record<string, unknown>) {
  const r = await fetch("/api/admin/dp/folha", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  return r.ok ? null : ((d.error as string) ?? "Falha ao salvar");
}

function baixarCsv(nome: string, linhas: (string | number)[][]) {
  const csv = "\ufeff" + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = nome;
  a.click();
}

export default function DpFolha({ employees }: { employees: DpEmployee[] }) {
  const [tab, setTab] = useState<"folha" | "passivo" | "guias">("passivo");
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [guias, setGuias] = useState<Guia[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/dp/folha");
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setErr(d.error ?? "Falha ao carregar");
    else { setComissoes(d.comissoes ?? []); setGuias(d.guias ?? []); setErr(null); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Folha e custos</h1>
        <p className="text-sm text-zinc-500">Estimativas de apoio ao contador. Esta tela não envia nada ao governo; os valores finais são do contador.</p>
      </div>
      <div className="flex gap-2">
        {([["folha", "Folha mensal"], ["passivo", "Regularização / passivo"], ["guias", "Guias e vencimentos"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${tab === k ? "bg-[#0b1f3a] text-white" : "border border-zinc-300 bg-white text-zinc-700"}`}>{l}</button>
        ))}
      </div>
      {err && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{err}</p>}
      {loading ? <p className="text-sm text-zinc-400">Carregando…</p> : tab === "folha" ? (
        <FolhaMensal employees={employees} comissoes={comissoes} />
      ) : tab === "passivo" ? (
        <Passivo employees={employees} comissoes={comissoes} onSaved={load} />
      ) : (
        <Guias employees={employees} comissoes={comissoes} guias={guias} onSaved={load} />
      )}
    </div>
  );
}

function Passivo({ employees, comissoes, onSaved }: { employees: DpEmployee[]; comissoes: Comissao[]; onSaved: () => void }) {
  const cands = employees.filter((e) => e.admitted_at && e.salary && e.status !== "desligado");
  const [empId, setEmpId] = useState(cands[0]?.id ?? "");
  const [multa, setMulta] = useState(800);
  const [fgtsPct, setFgtsPct] = useState(8);
  const [msg, setMsg] = useState<string | null>(null);
  const emp = cands.find((e) => e.id === empId);
  const comis = useMemo(() => Object.fromEntries(comissoes.filter((c) => c.employee_id === empId).map((c) => [c.competencia, Number(c.valor)])), [comissoes, empId]);
  const meses = useMemo(() => (emp ? calcMeses(emp, comis, fgtsPct / 100) : []), [emp, comis, fgtsPct]);

  const fgts = r2(meses.reduce((s, m) => s + m.fgts, 0));
  const inss = r2(meses.reduce((s, m) => s + m.inss, 0));
  const avos = meses.filter((m) => m.dias >= 15).length;
  const baseMedia = meses.length ? r2(meses.reduce((s, m) => s + m.base, 0) / meses.length) : 0;
  const baseCheia = emp && meses.length ? r2((emp.salary ?? 0) + (meses.reduce((s, m) => s + m.comissao, 0) / meses.length)) : baseMedia;
  const decimo = r2((baseCheia * avos) / 12);
  const ferias = r2(((baseCheia * avos) / 12) * (4 / 3));
  const total = r2(fgts + inss + decimo + ferias + multa);
  const semComissao = meses.filter((m) => !(m.ym in comis));

  async function setCom(ym: string, v: string) {
    const e = await salvar({ kind: "comissao", employee_id: empId, competencia: ym, valor: v === "" ? 0 : v });
    setMsg(e ?? "Comissão salva ✓");
    if (!e) onSaved();
  }

  if (!cands.length) return <p className="text-sm text-zinc-500">Nenhum colaborador ativo com admissão e salário cadastrados.</p>;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select className={inp} value={empId} onChange={(e) => setEmpId(e.target.value)}>{cands.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select>
        {emp && <span className="text-zinc-500">Admissão {fmt(emp.admitted_at)} · Salário {brl(emp.salary ?? 0)}</span>}
      </div>
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">⚠ ESTIMATIVA. Não inclui DSR sobre comissões, FGTS sobre 13º/férias, IRRF nem juros/correção. O contador valida os valores.</div>
      {semComissao.length > 0 && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">Validação do sistema: {semComissao.length} mês(es) sem comissão informada ({semComissao.map((m) => labelComp(m.ym)).join(", ")}). Digite 0 se não houve, para confirmar.</div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {([["FGTS", fgts], ["13º proporcional", decimo], ["Férias + 1/3", ferias], ["INSS empregado", inss], ["Multa art. 47", multa]] as const).map(([l, v]) => (
          <div key={l} className="rounded-xl border border-zinc-200 bg-white p-3"><p className="text-xs text-zinc-500">{l}</p><p className="text-lg font-semibold">{brl(v)}</p></div>
        ))}
        <div className="rounded-xl bg-teal-700 p-3 text-white"><p className="text-xs opacity-80">Total estimado</p><p className="text-xl font-bold">{brl(total)}</p></div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs text-zinc-600"><tr><th className="p-2">Mês</th><th>Dias</th><th>Salário</th><th>Comissão (editar)</th><th>Base</th><th>FGTS</th><th>INSS</th></tr></thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.ym} className="border-t border-zinc-100">
                <td className="p-2">{labelComp(m.ym)}{m.aberto && <span className="ml-1 text-xs text-zinc-400">(em curso)</span>}</td>
                <td>{m.dias}</td><td>{brl(m.salario)}</td>
                <td><input key={empId + m.ym + (comis[m.ym] ?? "")} className={`${inp} w-28`} inputMode="decimal" defaultValue={m.ym in comis ? String(comis[m.ym]).replace(".", ",") : ""} placeholder="0,00" onBlur={(e) => { if (e.target.value !== (m.ym in comis ? String(comis[m.ym]).replace(".", ",") : "")) void setCom(m.ym, e.target.value); }} /></td>
                <td>{brl(m.base)}</td><td>{brl(m.fgts)}</td><td>{brl(m.inss)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">FGTS %<input className={`${inp} w-16`} type="number" step="0.5" value={fgtsPct} onChange={(e) => setFgtsPct(Number(e.target.value) || 0)} /></label>
        <label className="flex items-center gap-2">Multa art. 47<select className={inp} value={multa} onChange={(e) => setMulta(Number(e.target.value))}><option value={800}>R$ 800 (ME/EPP)</option><option value={3000}>R$ 3.000 (demais)</option><option value={0}>Sem multa</option></select></label>
        <button className={btn2} onClick={() => baixarCsv(`passivo-${emp?.full_name ?? "colaborador"}.csv`, [["Mês", "Dias", "Salário", "Comissão", "Base", "FGTS", "INSS empregado"], ...meses.map((m) => [labelComp(m.ym), m.dias, m.salario, m.comissao, m.base, m.fgts, m.inss]), [], ["13º proporcional", decimo], ["Férias + 1/3", ferias], ["Multa art. 47", multa], ["Total estimado", total]])}>⬇ Exportar planilha</button>
        {msg && <span className="text-xs text-zinc-500">{msg}</span>}
      </div>
      <p className="text-xs text-zinc-400">INSS: tabela progressiva 2026 (confirmar com o contador). 13º e férias: {avos}/12 avos (mês com 15+ dias), sobre salário + média das comissões.</p>
    </div>
  );
}

const TIPOS: Record<string, { nome: string; onde: string; url: string }> = {
  fgts: { nome: "FGTS", onde: "FGTS Digital", url: "https://fgtsdigital.sistema.gov.br" },
  darf: { nome: "DARF INSS (DCTFWeb)", onde: "e-CAC › DCTFWeb", url: "https://cav.receita.fazenda.gov.br" },
  das: { nome: "DAS (Simples)", onde: "PGDAS-D", url: "https://www8.receita.fazenda.gov.br/simplesnacional/" },
};
const STATUS_STYLE: Record<string, string> = { pendente: "bg-red-100 text-red-700", emitida: "bg-amber-100 text-amber-800", paga: "bg-emerald-100 text-emerald-800" };

function Guias({ employees, comissoes, guias, onSaved }: { employees: DpEmployee[]; comissoes: Comissao[]; guias: Guia[]; onSaved: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Guia>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const est = useMemo(() => {
    const m: Record<string, { fgts: number; darf: number; semCom: boolean }> = {};
    for (const e of employees) {
      if (!e.admitted_at || !e.salary) continue;
      const comis = Object.fromEntries(comissoes.filter((c) => c.employee_id === e.id).map((c) => [c.competencia, Number(c.valor)]));
      for (const x of calcMeses(e, comis, 0.08)) {
        const cur = (m[x.ym] ??= { fgts: 0, darf: 0, semCom: false });
        cur.fgts = r2(cur.fgts + x.fgts);
        cur.darf = r2(cur.darf + x.inss);
        if (!(x.ym in comis) && e.role_title.toLowerCase().includes("vendas")) cur.semCom = true;
      }
    }
    return m;
  }, [employees, comissoes]);

  const comps = Object.keys(est).sort().reverse();
  const get = (c: string, t: string) => guias.find((g) => g.competencia === c && g.tipo === t);
  const hoje = todayIso();
  const venc = (c: string) => `${nextYm(c)}-20`;

  async function gravar(c: string, t: string) {
    const e = await salvar({ kind: "guia", competencia: c, tipo: t, ...form });
    setMsg(e ?? "Guia salva ✓");
    if (!e) { setOpen(null); onSaved(); }
  }

  if (!comps.length) return <p className="text-sm text-zinc-500">Sem competências: cadastre admissão e salário dos colaboradores.</p>;
  const linhas = comps.flatMap((c) => (["fgts", "darf", "das"] as const).map((t) => ({ c, t })));
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">⚠ Valores estimados. Vencimento pela regra geral (dia 20 do mês seguinte, ajustar se cair em dia não útil). O contador confirma. O sistema só guarda o controle: nada é emitido ou pago por aqui.</div>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left text-xs text-zinc-600"><tr><th className="p-2">Competência</th><th>Guia</th><th>Onde emitir</th><th>Valor</th><th>Vence</th><th>Status</th><th>Sistema</th><th>Contador</th><th /></tr></thead>
          <tbody>
            {linhas.map(({ c, t }) => {
              const g = get(c, t);
              const e = est[c];
              const estimado = t === "fgts" ? e.fgts : t === "darf" ? e.darf : null;
              const valor = g?.valor ?? estimado;
              const status = g?.status ?? "pendente";
              const atras = status !== "paga" && venc(c) < hoje;
              const key = c + t;
              const sist = t === "das" ? { t: "manual", c: "text-zinc-400" } : e.semCom ? { t: "⚠ sem comissão", c: "text-amber-700" } : { t: "✔ conferido", c: "text-emerald-700" };
              return (
                <Fragment key={key}>
                  <tr className="border-t border-zinc-100">
                    <td className="p-2">{labelComp(c)}</td>
                    <td>{TIPOS[t].nome}</td>
                    <td><a className="text-sky-700 underline" href={TIPOS[t].url} target="_blank" rel="noopener noreferrer">{TIPOS[t].onde} ↗</a></td>
                    <td>{valor === null || valor === undefined ? "—" : brl(Number(valor))}{g?.valor == null && estimado !== null && <span className="ml-1 text-xs text-zinc-400">est.</span>}</td>
                    <td className={atras ? "font-semibold text-red-700" : ""}>{fmt(venc(c))}</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[status]}`}>{status === "pendente" ? (atras ? "Atrasada" : "Pendente") : status === "emitida" ? "Guia emitida" : "Paga"}</span></td>
                    <td className={`text-xs ${sist.c}`}>{sist.t}</td>
                    <td className="text-xs">{g?.contador_em ? `✔ ${fmt(g.contador_em)} · ${g.contador_nome ?? ""}` : <span className="text-zinc-400">aguardando</span>}</td>
                    <td><button className={btn2} onClick={() => { setOpen(open === key ? null : key); setForm({ valor: g?.valor ?? estimado ?? null, status, codigo: g?.codigo ?? "", pago_em: g?.pago_em ?? "", contador_nome: g?.contador_nome ?? "", contador_em: g?.contador_em ?? "", notes: g?.notes ?? "" }); setMsg(null); }}>Editar</button></td>
                  </tr>
                  {open === key && (
                    <tr className="bg-zinc-50">
                      <td colSpan={9} className="p-3">
                        <div className="grid gap-2 text-xs md:grid-cols-4">
                          <label>Valor real (R$)<input className={`${inp} w-full`} inputMode="decimal" defaultValue={form.valor != null ? String(form.valor).replace(".", ",") : ""} onChange={(ev) => setForm({ ...form, valor: ev.target.value === "" ? null : (ev.target.value.replace(",", ".") as unknown as number) })} /></label>
                          <label>Status<select className={`${inp} w-full`} value={form.status} onChange={(ev) => setForm({ ...form, status: ev.target.value })}><option value="pendente">Pendente</option><option value="emitida">Guia emitida</option><option value="paga">Paga</option></select></label>
                          <label>Pago em<input type="date" className={`${inp} w-full`} value={form.pago_em ?? ""} onChange={(ev) => setForm({ ...form, pago_em: ev.target.value })} /></label>
                          <label>Código de barras / PIX<input className={`${inp} w-full`} value={form.codigo ?? ""} onChange={(ev) => setForm({ ...form, codigo: ev.target.value })} /></label>
                          <label>Contador (nome)<input className={`${inp} w-full`} value={form.contador_nome ?? ""} onChange={(ev) => setForm({ ...form, contador_nome: ev.target.value })} /></label>
                          <label>Confirmado em<input type="date" className={`${inp} w-full`} value={form.contador_em ?? ""} onChange={(ev) => setForm({ ...form, contador_em: ev.target.value })} /></label>
                          <label className="md:col-span-2">Observação<input className={`${inp} w-full`} value={form.notes ?? ""} onChange={(ev) => setForm({ ...form, notes: ev.target.value })} /></label>
                        </div>
                        <div className="mt-2 flex items-center gap-3"><button className={btn} onClick={() => void gravar(c, t)}>Salvar</button>{msg && <span className="text-xs text-zinc-500">{msg}</span>}</div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────────── Folha mensal: S-1010 · S-1020 · S-1200 · S-1299 ───────────── */

interface Ocor { tipo: string | null; codigo: string | null; descricao: string | null; localizacao: string | null }
interface Ev {
  id: string;
  employee_id: string | null;
  tipo: string;
  status: string;
  ambiente: string | null;
  params: Record<string, string> | null;
  resposta: { resumo?: { fault?: string | null; eventos?: { recibo: string | null; descResposta: string | null; ocorrencias: Ocor[] }[] } } | null;
  created_at: string;
}
const TIPOS_FOLHA = ["S-1010", "S-1020", "S-1200", "S-1299"] as const;
const ST_STYLE: Record<string, string> = {
  assinado: "bg-amber-100 text-amber-800",
  enviado: "bg-sky-100 text-sky-800",
  processado: "bg-emerald-100 text-emerald-800",
  rejeitado: "bg-red-100 text-red-700",
  erro: "bg-red-100 text-red-700",
};
const ST_LABEL: Record<string, string> = { assinado: "gerado (não enviado)", enviado: "enviado · aguardando", processado: "processado", rejeitado: "rejeitado", erro: "erro no envio" };
const btnL = "rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-zinc-50 disabled:opacity-40";
const btnEnviar = "rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-40";

function FolhaMensal({ employees, comissoes }: { employees: DpEmployee[]; comissoes: Comissao[] }) {
  const [evs, setEvs] = useState<Ev[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [xml, setXml] = useState<{ titulo: string; xml: string } | null>(null);
  const [fpas, setFpas] = useState("515");
  const [dctf, setDctf] = useState(true);

  const carregar = useCallback(async () => {
    const todos = await Promise.all(TIPOS_FOLHA.map((t) => fetch(`/api/admin/dp/esocial/events?tipo=${t}`).then((r) => r.json().catch(() => ({})))));
    setEvs(todos.flatMap((d) => (d.eventos ?? []) as Ev[]));
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const ativos = useMemo(() => employees.filter((e) => e.admitted_at && e.salary), [employees]);
  const porFunc = useMemo(() => {
    const out: Record<string, Record<string, Mes>> = {};
    for (const e of ativos) {
      const comis = Object.fromEntries(comissoes.filter((c) => c.employee_id === e.id).map((c) => [c.competencia, Number(c.valor)]));
      out[e.id] = Object.fromEntries(calcMeses(e, comis, 0.08).map((m) => [m.ym, m]));
    }
    return out;
  }, [ativos, comissoes]);
  const comps = useMemo(() => [...new Set(Object.values(porFunc).flatMap((o) => Object.keys(o)))].sort(), [porFunc]);
  const [comp, setComp] = useState("");
  const cur = comp || comps[0] || "";

  const ultimo = (tipo: string, f: (e: Ev) => boolean = () => true) => evs.filter((e) => e.tipo === tipo && f(e)).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const evRub = (k: string) => ultimo("S-1010", (e) => e.params?.rubrica === k);
  const ev1020 = ultimo("S-1020");
  const evRem = (id: string) => ultimo("S-1200", (e) => e.employee_id === id && e.params?.perApur === cur);
  const ev1299 = ultimo("S-1299", (e) => e.params?.perApur === cur);

  async function gerar(chave: string, tipo: string, params: Record<string, string>, employee_id?: string) {
    setBusy(chave); setMsg(null);
    const r = await fetch("/api/admin/dp/esocial/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo, params, employee_id }) });
    const d = await r.json().catch(() => ({}));
    setMsg(r.ok ? `${tipo} gerado e assinado. Confira o XML antes de enviar.` : `${d.error ?? "Falha"}${d.missing ? ": " + d.missing.join(", ") : ""}`);
    setBusy(null);
    await carregar();
  }
  async function acao(ev: Ev, action: "enviar" | "consultar") {
    if (action === "enviar" && !confirm(`ATENÇÃO — se o sistema estiver em PRODUÇÃO, o envio do ${ev.tipo} tem valor legal.\n\nConfirmar o envio ao eSocial?`)) return;
    setBusy(ev.id); setMsg(null);
    const r = await fetch(`/api/admin/dp/esocial/events/${ev.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, confirm: true, confirmProducao: true }) });
    const d = await r.json().catch(() => ({}));
    setMsg(r.ok ? (action === "enviar" ? `${ev.tipo} enviado (${d.status}). Clique em Consultar resultado.` : `${ev.tipo}: ${d.status}`) : (d.error ?? "Falha"));
    setBusy(null);
    await carregar();
  }
  async function verXml(ev: Ev) {
    const r = await fetch(`/api/admin/dp/esocial/events/${ev.id}`);
    const d = await r.json().catch(() => ({}));
    if (r.ok) setXml({ titulo: `${ev.tipo} · ${ev.id.slice(0, 8)}`, xml: d.evento.xml });
  }

  const ok = (e?: Ev) => e?.status === "processado";
  const tabelasOk = ok(evRub("SAL")) && ok(ev1020);
  const funcMes = ativos.filter((e) => porFunc[e.id]?.[cur]);
  const todosRem = funcMes.length > 0 && funcMes.every((e) => ok(evRem(e.id)));

  function Linha({ chave, titulo, detalhe, ev, bloqueio, onGerar }: { chave: string; titulo: string; detalhe?: string; ev?: Ev; bloqueio?: string | null; onGerar: () => void }) {
    const rec = ev?.resposta?.resumo?.eventos?.[0];
    const ocs = (rec?.ocorrencias ?? []).filter((o) => o.tipo === "1" || ev?.status === "rejeitado");
    return (
      <div className="border-t border-zinc-100 py-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-[200px] font-medium">{titulo}</span>
          {detalhe && <span className="text-xs text-zinc-500">{detalhe}</span>}
          <span className={`rounded-full px-2 py-0.5 text-xs ${ev ? ST_STYLE[ev.status] : "bg-zinc-100 text-zinc-600"}`}>{ev ? ST_LABEL[ev.status] ?? ev.status : "não gerado"}</span>
          {ev?.status === "processado" && rec?.recibo && <span className="text-xs text-zinc-500">recibo {rec.recibo}</span>}
          <span className="ml-auto flex flex-wrap gap-1">
            {ev?.status !== "processado" && ev?.status !== "enviado" && <button className={btnL} disabled={!!bloqueio || busy === chave} title={bloqueio ?? ""} onClick={onGerar}>{ev ? "Gerar de novo" : "Gerar"}</button>}
            {ev && <button className={btnL} onClick={() => void verXml(ev)}>Ver XML</button>}
            {ev && (ev.status === "assinado" || ev.status === "erro") && <button className={btnEnviar} disabled={busy === ev.id} onClick={() => void acao(ev, "enviar")}>Enviar</button>}
            {ev?.status === "enviado" && <button className={btnL} disabled={busy === ev.id} onClick={() => void acao(ev, "consultar")}>Consultar resultado</button>}
          </span>
        </div>
        {bloqueio && !ev && <p className="mt-1 text-xs text-zinc-400">{bloqueio}</p>}
        {ocs.length > 0 && (ev?.status === "rejeitado" || ev?.status === "erro") && (
          <ul className="mt-1 list-disc pl-5 text-xs text-red-700">{ocs.map((o, i) => <li key={i}>{o.codigo ? `[${o.codigo}] ` : ""}{o.descricao}{o.localizacao ? ` (${o.localizacao})` : ""}</li>)}</ul>
        )}
      </div>
    );
  }

  if (!comps.length) return <p className="text-sm text-zinc-500">Cadastre admissão e salário dos colaboradores para montar a folha.</p>;
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">Cada envio ao eSocial pede confirmação e, em PRODUÇÃO, tem valor legal. Gerar não envia nada.</div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-[#0b1f3a]">Passo 1 · Tabelas (uma vez só)</h2>
        <p className="mb-1 text-xs text-zinc-500">Rubricas (S-1010) e lotação tributária (S-1020). Precisam estar processadas antes da folha.</p>
        <Linha chave="r-SAL" titulo="Rubrica Salário (S-1010)" ev={evRub("SAL")} onGerar={() => void gerar("r-SAL", "S-1010", { rubrica: "SAL" })} />
        <Linha chave="r-COM" titulo="Rubrica Comissões (S-1010)" ev={evRub("COM")} onGerar={() => void gerar("r-COM", "S-1010", { rubrica: "COM" })} />
        <Linha chave="lot" titulo="Lotação tributária (S-1020)" detalhe={`FPAS ${fpas}`} ev={ev1020} onGerar={() => void gerar("lot", "S-1020", { fpas })} />
        <label className="mt-2 flex items-center gap-2 text-xs text-zinc-500">FPAS (Tabela 04 — confirmar com o contador)<input className={`${inp} w-20`} value={fpas} onChange={(e) => setFpas(e.target.value.replace(/\D/g, "").slice(0, 3))} /></label>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        Competência:
        <select className={inp} value={cur} onChange={(e) => setComp(e.target.value)}>{comps.map((c) => <option key={c} value={c}>{labelComp(c)}</option>)}</select>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-[#0b1f3a]">Passo 2 · Remuneração por colaborador (S-1200) · {labelComp(cur)}</h2>
        {funcMes.map((e) => {
          const m = porFunc[e.id][cur];
          const temCom = comissoes.some((c) => c.employee_id === e.id && c.competencia === cur);
          let bloqueio: string | null = null;
          if (!tabelasOk) bloqueio = "Antes: S-1010 (Salário) e S-1020 precisam estar processados.";
          else if (m.comissao > 0 && !ok(evRub("COM"))) bloqueio = "Antes: a rubrica de Comissões (S-1010) precisa estar processada.";
          else if (m.aberto) bloqueio = "Mês em curso: gere depois que o mês terminar.";
          else if (!temCom) bloqueio = "Informe a comissão do mês (0 se não houve) na aba Regularização / passivo.";
          return (
            <Linha key={e.id} chave={"rem" + e.id} titulo={e.full_name} detalhe={`salário ${brl(m.salario)} · comissão ${brl(m.comissao)} · INSS ${brl(m.inss)} · FGTS ${brl(m.fgts)}`} ev={evRem(e.id)} bloqueio={bloqueio}
              onGerar={() => void gerar("rem" + e.id, "S-1200", { perApur: cur, vrSal: m.salario.toFixed(2), vrCom: m.comissao > 0 ? m.comissao.toFixed(2) : "" }, e.id)} />
          );
        })}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-[#0b1f3a]">Passo 3 · Fechamento da competência (S-1299) · {labelComp(cur)}</h2>
        <p className="mb-1 text-xs text-zinc-500">Depois do fechamento, o FGTS Digital e a DCTFWeb recebem os dados e liberam as guias.</p>
        <Linha chave="fecha" titulo={`Fechamento ${labelComp(cur)}`} ev={ev1299} bloqueio={todosRem ? null : "Libera quando todos os S-1200 do mês estiverem processados."}
          onGerar={() => void gerar("fecha", "S-1299", { perApur: cur, transDCTFWeb: dctf ? "S" : "N" })} />
        <label className="mt-2 flex items-center gap-2 text-xs text-zinc-500"><input type="checkbox" checked={dctf} onChange={(e) => setDctf(e.target.checked)} />Transmitir à DCTFWeb (gera o DARF do INSS)</label>
      </div>

      {msg && <p className="rounded-md bg-zinc-100 p-2 text-sm text-zinc-700">{msg}</p>}
      {xml && (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">XML assinado · {xml.titulo}</h3><button className={btnL} onClick={() => setXml(null)}>Fechar</button></div>
          <textarea readOnly className="h-48 w-full rounded-md border border-zinc-300 p-2 font-mono text-xs" value={xml.xml} />
        </div>
      )}
    </div>
  );
}
