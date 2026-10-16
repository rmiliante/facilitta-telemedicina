"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildAlerts,
  daysUntil,
  DP_STATUS_LABEL,
  DP_STATUSES,
  monthlyCost,
  type DpAdmissionItem,
  type DpEmployee,
  type DpStatus,
} from "@/lib/dp";

type View = "dashboard" | "colaboradores" | "admissoes" | "ficha";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brl0 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtDate = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");

const STATUS_STYLE: Record<DpStatus, string> = {
  admissao: "bg-blue-100 text-blue-800",
  experiencia: "bg-amber-100 text-amber-800",
  ativo: "bg-emerald-100 text-emerald-800",
  ferias: "bg-sky-100 text-sky-800",
  desligado: "bg-zinc-200 text-zinc-600",
};

const NAV: { key: View | "soon"; label: string; soon?: boolean }[] = [
  { key: "dashboard", label: "Dashboard DP" },
  { key: "colaboradores", label: "Colaboradores" },
  { key: "admissoes", label: "Admissões" },
  { key: "soon", label: "Férias e ausências", soon: true },
  { key: "soon", label: "Documentos e ASO", soon: true },
  { key: "soon", label: "Folha e custos", soon: true },
  { key: "soon", label: "Relatórios", soon: true },
];

function nextDue(e: DpEmployee): string {
  if (e.status === "desligado") return "—";
  const items: [number | null, string][] = [
    [e.status === "experiencia" ? daysUntil(e.experience_end) : null, "Experiência termina"],
    [daysUntil(e.aso_due), "ASO"],
    [e.status !== "ferias" ? daysUntil(e.vacation_due) : null, "Férias vencem"],
  ];
  const valid = items.filter(([d]) => d !== null && d <= 90) as [number, string][];
  if (e.status === "ferias" && e.vacation_return) return `Retorno em ${fmtDate(e.vacation_return)}`;
  if (!valid.length) return "Sem pendências";
  valid.sort((a, b) => a[0] - b[0]);
  const [d, label] = valid[0];
  return d < 0 ? `${label} vencido há ${-d} dias` : `${label} em ${d} dias`;
}

export default function DpClient() {
  const [view, setView] = useState<View>("dashboard");
  const [employees, setEmployees] = useState<DpEmployee[]>([]);
  const [pending, setPending] = useState<Record<string, number>>({});
  const [total, setTotal] = useState<Record<string, number>>({});
  const [receita, setReceita] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([fetch("/api/admin/dp/employees"), fetch("/api/admin/dp/settings")]);
      const d1 = await r1.json().catch(() => ({}));
      if (!r1.ok) throw new Error(d1.error ?? "Não foi possível carregar");
      setEmployees(d1.employees ?? []);
      setPending(d1.pending ?? {});
      setTotal(d1.total ?? {});
      const d2 = await r2.json().catch(() => ({}));
      setReceita(typeof d2.receita12m === "number" ? d2.receita12m : null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openFicha(id: string) {
    setOpenId(id);
    setView("ficha");
  }

  const current = view === "ficha" ? "colaboradores" : view;

  return (
    <div className="flex min-h-screen bg-[#f4f6f8] text-zinc-800">
      <aside className="hidden w-60 shrink-0 flex-col bg-[#0b1f3a] p-4 text-white md:flex">
        <div className="mb-6 text-lg font-semibold">
          facilitta<span className="text-teal-300"> saúde</span>
        </div>
        <p className="mb-2 text-[10px] font-semibold tracking-widest text-slate-400">DEPARTAMENTO PESSOAL</p>
        <nav className="space-y-1">
          {NAV.map((n) =>
            n.soon ? (
              <div key={n.label} className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500" title="Em breve">
                <span className="h-2 w-2 rounded-sm bg-slate-600" />
                {n.label}
                <span className="ml-auto text-[10px]">em breve</span>
              </div>
            ) : (
              <button
                key={n.label}
                onClick={() => setView(n.key as View)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium ${
                  current === n.key ? "bg-[#12335a] text-white" : "text-slate-300 hover:bg-[#12335a]/60"
                }`}
              >
                <span className={`h-2 w-2 rounded-sm ${current === n.key ? "bg-teal-300" : "bg-slate-500"}`} />
                {n.label}
              </button>
            ),
          )}
        </nav>
        <a href="/admin" className="mt-auto rounded-lg bg-[#12335a] px-3 py-2 text-xs text-slate-200 hover:bg-[#17406f]">
          ← Voltar ao painel admin
        </a>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mb-4 flex gap-2 md:hidden">
          {NAV.filter((n) => !n.soon).map((n) => (
            <button key={n.label} onClick={() => setView(n.key as View)} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs">
              {n.label}
            </button>
          ))}
          <a href="/admin" className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs">
            Admin
          </a>
        </div>
        {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {loading ? (
          <p className="text-sm text-zinc-400">Carregando…</p>
        ) : view === "dashboard" ? (
          <Dashboard employees={employees} pending={pending} total={total} receita={receita} onReceita={setReceita} onOpen={openFicha} onNew={() => setShowNew(true)} />
        ) : view === "colaboradores" ? (
          <Colaboradores employees={employees} pending={pending} onOpen={openFicha} onNew={() => setShowNew(true)} />
        ) : view === "admissoes" ? (
          <Admissoes employees={employees} pending={pending} total={total} onOpen={openFicha} onNew={() => setShowNew(true)} />
        ) : openId ? (
          <Ficha id={openId} receita={receita} employees={employees} onBack={() => setView("colaboradores")} onChanged={load} />
        ) : null}
      </main>

      {showNew && (
        <NewEmployee
          onClose={() => setShowNew(false)}
          onCreated={async (id) => {
            setShowNew(false);
            await load();
            openFicha(id);
          }}
        />
      )}
    </div>
  );
}

function Header({ title, sub, action }: { title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-[#0b1f3a]">{title}</h1>
        <p className="text-xs text-zinc-500">{sub}</p>
      </div>
      {action}
    </div>
  );
}

const btnPrimary = "rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-[#06231f] hover:bg-teal-400 disabled:opacity-50";

function Dashboard({
  employees, pending, total, receita, onReceita, onOpen, onNew,
}: {
  employees: DpEmployee[]; pending: Record<string, number>; total: Record<string, number>;
  receita: number | null; onReceita: (n: number | null) => void; onOpen: (id: string) => void; onNew: () => void;
}) {
  const active = employees.filter((e) => e.status !== "desligado");
  const cost = active.reduce((s, e) => s + monthlyCost(e.salary).total, 0);
  const alerts = useMemo(() => buildAlerts(employees, pending), [employees, pending]);
  const adm = employees.filter((e) => e.status === "admissao");
  const admDone = adm.reduce((s, e) => s + ((total[e.id] ?? 0) - (pending[e.id] ?? 0)), 0);
  const admTotal = adm.reduce((s, e) => s + (total[e.id] ?? 0), 0);
  const count = (s: DpStatus) => active.filter((e) => e.status === s).length;
  const folha12 = cost * 12;
  const fator = receita && receita > 0 ? (folha12 / receita) * 100 : null;
  const [draft, setDraft] = useState("");

  async function saveReceita() {
    const v = Number(draft.replace(/\./g, "").replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return alert("Informe um valor válido.");
    if (!confirm(`Confirma a receita dos últimos 12 meses em ${brl0(v)}?`)) return;
    const res = await fetch("/api/admin/dp/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receita12m: v }) });
    if (res.ok) {
      onReceita(v);
      setDraft("");
    } else alert("Não foi possível salvar.");
  }

  const dot = { urgente: "bg-red-500", atencao: "bg-amber-500", info: "bg-blue-500" } as const;
  return (
    <>
      <Header title="Dashboard do Departamento Pessoal" sub="Visão geral da equipe CLT" action={<button onClick={onNew} className={btnPrimary}>+ Novo colaborador</button>} />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Colaboradores na equipe" value={String(active.length)} note={`${count("ferias")} em férias · ${count("experiencia")} em experiência · ${count("admissao")} em admissão`} />
        <Kpi label="Custo mensal estimado" value={brl0(cost)} note="salários + encargos + provisões" />
        <Kpi label="Admissões em andamento" value={String(adm.length)} note={adm.length ? `checklist ${admDone} de ${admTotal} itens` : "nenhuma"} />
        <Kpi label="Alertas abertos" value={String(alerts.length)} note={`${alerts.filter((a) => a.level === "urgente").length} urgente(s)`} />
      </div>
      <div className="mb-5 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold text-[#0b1f3a]">Fator R · enquadramento no Simples Nacional</h2>
        {fator !== null ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-[#0b1f3a]">{fator.toFixed(1).replace(".", ",")}%</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${fator >= 28 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>
                {fator >= 28 ? "Anexo III · acima de 28%" : "Abaixo de 28% · risco de Anexo V"}
              </span>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Folha 12 meses (estimada: custo atual × 12): {brl0(folha12)} · Receita 12 meses (informada): {brl0(receita!)}. Estimativa: não inclui pró-labore nem histórico real da folha.
            </p>
          </>
        ) : (
          <p className="text-sm text-zinc-500">Informe a receita bruta dos últimos 12 meses para calcular o Fator R.</p>
        )}
        <div className="mt-3 flex gap-2">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={receita ? `Atualizar (atual ${brl0(receita)})` : "Receita 12 meses, ex.: 1320000"} className="w-72 rounded-md border border-zinc-300 px-3 py-1.5 text-sm" />
          <button onClick={saveReceita} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50">Salvar</button>
        </div>
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#0b1f3a]">Alertas e vencimentos</h2>
        {alerts.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum alerta no momento.</p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {alerts.map((a, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <span className={`h-2.5 w-2.5 rounded-full ${dot[a.level]}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="text-xs text-zinc-500">{a.detail}</p>
                </div>
                <button onClick={() => onOpen(a.employeeId)} className="text-xs font-semibold text-teal-700 hover:underline">Abrir ficha</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#0b1f3a]">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{note}</p>
    </div>
  );
}

function Colaboradores({ employees, pending, onOpen, onNew }: { employees: DpEmployee[]; pending: Record<string, number>; onOpen: (id: string) => void; onNew: () => void }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<DpStatus | "todos">("todos");
  const list = employees.filter((e) => {
    const t = q.trim().toLowerCase();
    return (filter === "todos" || e.status === filter) && (!t || `${e.full_name} ${e.role_title} ${e.department ?? ""}`.toLowerCase().includes(t));
  });
  const n = (s: DpStatus) => employees.filter((e) => e.status === s).length;
  return (
    <>
      <Header title="Colaboradores" sub={`Cadastro da equipe CLT · ${employees.length} registros`} action={<button onClick={onNew} className={btnPrimary}>+ Novo colaborador</button>} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, cargo ou setor…" className="w-64 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm" />
        <button onClick={() => setFilter("todos")} className={`rounded-full px-3 py-1 text-xs font-semibold ${filter === "todos" ? "bg-[#0b1f3a] text-white" : "border border-zinc-300 bg-white"}`}>Todos ({employees.length})</button>
        {DP_STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[s]} ${filter === s ? "ring-2 ring-[#0b1f3a]" : ""}`}>
            {DP_STATUS_LABEL[s]} ({n(s)})
          </button>
        ))}
        <span className="ml-auto rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] text-zinc-500">Salários visíveis só para o Master</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-400">
              {["Colaborador", "Cargo", "Setor", "Admissão", "Salário base", "Status", "Próximo vencimento", ""].map((h) => (
                <th key={h} className="px-3 py-3 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id} className="border-t border-zinc-100">
                <td className="px-3 py-3 font-semibold">{e.full_name}</td>
                <td className="px-3 py-3">{e.role_title}</td>
                <td className="px-3 py-3">{e.department ?? "—"}</td>
                <td className="px-3 py-3">{fmtDate(e.admitted_at)}</td>
                <td className="px-3 py-3">{e.salary != null ? brl0(Number(e.salary)) : "—"}</td>
                <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[e.status]}`}>{DP_STATUS_LABEL[e.status]}</span></td>
                <td className="px-3 py-3 text-zinc-600">{e.status === "admissao" ? (pending[e.id] ? `Faltam ${pending[e.id]} itens` : "Checklist completo") : nextDue(e)}</td>
                <td className="px-3 py-3 text-right"><button onClick={() => onOpen(e.id)} className="text-xs font-semibold text-teal-700 hover:underline">Abrir ficha</button></td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-zinc-400">Nenhum colaborador encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Admissoes({ employees, pending, total, onOpen, onNew }: { employees: DpEmployee[]; pending: Record<string, number>; total: Record<string, number>; onOpen: (id: string) => void; onNew: () => void }) {
  const list = employees.filter((e) => e.status === "admissao");
  return (
    <>
      <Header title="Admissões" sub="Checklist de admissão em andamento" action={<button onClick={onNew} className={btnPrimary}>+ Nova admissão</button>} />
      {list.length === 0 ? (
        <p className="rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500">Nenhuma admissão em andamento.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((e) => {
            const t = total[e.id] ?? 0;
            const d = t - (pending[e.id] ?? 0);
            return (
              <button key={e.id} onClick={() => onOpen(e.id)} className="rounded-xl border border-zinc-200 bg-white p-4 text-left hover:border-teal-400">
                <p className="font-semibold">{e.full_name}</p>
                <p className="text-xs text-zinc-500">{e.role_title}{e.department ? ` · ${e.department}` : ""} · admissão em {fmtDate(e.admitted_at)}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full bg-teal-400" style={{ width: t ? `${(d / t) * 100}%` : "0%" }} />
                </div>
                <p className="mt-1 text-xs font-semibold text-teal-700">{d} de {t} concluídos</p>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

function Ficha({ id, receita, employees, onBack, onChanged }: { id: string; receita: number | null; employees: DpEmployee[]; onBack: () => void; onChanged: () => Promise<void> }) {
  const [emp, setEmp] = useState<DpEmployee | null>(null);
  const [items, setItems] = useState<DpAdmissionItem[]>([]);
  const [tab, setTab] = useState<"admissao" | "dados">("admissao");
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/dp/employees/${id}`);
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      setEmp(d.employee);
      setItems(d.items ?? []);
      const e: DpEmployee = d.employee;
      setForm({
        full_name: e.full_name, cpf: e.cpf ?? "", role_title: e.role_title, department: e.department ?? "",
        admitted_at: e.admitted_at?.slice(0, 10) ?? "", salary: e.salary != null ? String(e.salary) : "", status: e.status,
        experience_end: e.experience_end?.slice(0, 10) ?? "", vacation_due: e.vacation_due?.slice(0, 10) ?? "",
        vacation_return: e.vacation_return?.slice(0, 10) ?? "", aso_due: e.aso_due?.slice(0, 10) ?? "", terminated_at: e.terminated_at?.slice(0, 10) ?? "", notes: e.notes ?? "",
      });
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (!emp) return <p className="text-sm text-zinc-400">Carregando…</p>;

  async function toggle(item: DpAdmissionItem) {
    if (!confirm(`${item.done ? "Desmarcar" : "Marcar como concluído"}: "${item.label}"?`)) return;
    const res = await fetch(`/api/admin/dp/employees/${id}/admission`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item_id: item.id, done: !item.done }) });
    if (res.ok) {
      await load();
      await onChanged();
    } else alert("Não foi possível atualizar o item.");
  }

  async function save() {
    if (!confirm("Confirma salvar as alterações deste colaborador?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/dp/employees/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return alert(d.error ?? "Não foi possível salvar.");
      await load();
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  const done = items.filter((i) => i.done).length;
  const c = monthlyCost(emp.salary);
  const others = employees.filter((e) => e.status !== "desligado" && e.id !== emp.id).reduce((s, e) => s + monthlyCost(e.salary).total, 0);
  const impact = receita && receita > 0 && emp.status !== "desligado" ? ((((others + c.total) * 12) / receita) - ((others * 12) / receita)) * 100 : null;
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const field = (k: string, label: string, type = "text") => (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-zinc-600">{label}</span>
      <input type={type} value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
    </label>
  );

  return (
    <>
      <button onClick={onBack} className="mb-3 text-xs font-semibold text-teal-700 hover:underline">← Colaboradores</button>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#0b1f3a]">{emp.full_name}</h1>
          <p className="text-xs text-zinc-500">{emp.role_title}{emp.department ? ` · ${emp.department}` : ""}{emp.admitted_at ? ` · admissão em ${fmtDate(emp.admitted_at)}` : ""}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[emp.status]}`}>{DP_STATUS_LABEL[emp.status]}</span>
      </div>
      <div className="mb-4 flex gap-5 border-b border-zinc-200 text-sm">
        {([["admissao", "Admissão"], ["dados", "Dados e vencimentos"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`pb-2 font-semibold ${tab === k ? "border-b-2 border-teal-500 text-[#0b1f3a]" : "text-zinc-400"}`}>{l}</button>
        ))}
        {["Documentos", "Férias e ausências", "Histórico"].map((l) => (
          <span key={l} className="cursor-not-allowed pb-2 text-zinc-300" title="Em breve">{l}</span>
        ))}
      </div>

      {tab === "admissao" ? (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <h2 className="font-semibold text-[#0b1f3a]">Checklist de admissão</h2>
              {items.length > 0 && <span className="text-xs font-semibold text-teal-700">{done} de {items.length} concluídos</span>}
            </div>
            {items.length === 0 ? (
              <p className="text-sm text-zinc-500">Este colaborador não tem checklist de admissão (cadastrado como {DP_STATUS_LABEL[emp.status]}).</p>
            ) : (
              <>
                <div className="mb-3 h-2 overflow-hidden rounded-full bg-zinc-100"><div className="h-full bg-teal-400" style={{ width: `${(done / items.length) * 100}%` }} /></div>
                <ul className="divide-y divide-zinc-100">
                  {items.map((it) => (
                    <li key={it.id}>
                      <button onClick={() => toggle(it)} className="flex w-full items-center gap-3 py-2.5 text-left text-sm">
                        <span className={`flex h-5 w-5 items-center justify-center rounded border text-[11px] ${it.done ? "border-teal-500 bg-teal-500 text-white" : "border-amber-400"}`}>{it.done ? "✓" : ""}</span>
                        <span className={it.done ? "text-zinc-400 line-through" : "font-semibold"}>{it.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">O envio ao eSocial continua sendo feito por você ou pelo contador. O sistema controla o status e os prazos.</p>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-white p-5">
              <h2 className="mb-3 text-sm font-semibold text-[#0b1f3a]">Custo mensal estimado do colaborador</h2>
              {([["Salário base", c.salary], ["FGTS (8%)", c.fgts], ["Provisão de 13º salário", c.decimo], ["Provisão de férias + 1/3", c.ferias], ["FGTS sobre provisões", c.fgtsProv]] as const).map(([l, v]) => (
                <div key={l} className="flex justify-between border-b border-zinc-100 py-1.5 text-sm"><span className="text-zinc-600">{l}</span><span className="font-semibold">{brl(v)}</span></div>
              ))}
              <div className="mt-2 flex justify-between text-base font-bold text-[#0b1f3a]"><span>Total estimado</span><span>{brl(c.total)}</span></div>
              <p className="mt-1 text-[11px] text-zinc-400">INSS patronal incluído no DAS (Simples Nacional). Estimativa, sem benefícios.</p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm">
              <h2 className="mb-2 font-semibold text-[#0b1f3a]">Impacto no Fator R</h2>
              {impact !== null ? (
                <p className="text-zinc-600">Esta pessoa soma <b>{brl0(c.total)}/mês</b> à folha e muda o Fator R em cerca de <b className="text-teal-700">{impact >= 0 ? "+" : ""}{impact.toFixed(1).replace(".", ",")} p.p.</b> sobre a receita de 12 meses informada.</p>
              ) : (
                <p className="text-zinc-500">Informe a receita de 12 meses no Dashboard DP para calcular.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {field("full_name", "Nome completo")}
            {field("cpf", "CPF")}
            {field("role_title", "Cargo")}
            {field("department", "Setor")}
            {field("admitted_at", "Data de admissão", "date")}
            {field("salary", "Salário base (R$)", "number")}
            <label className="block text-xs">
              <span className="mb-1 block font-medium text-zinc-600">Status</span>
              <select value={form.status ?? ""} onChange={(e) => set("status", e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
                {DP_STATUSES.map((s) => <option key={s} value={s}>{DP_STATUS_LABEL[s]}</option>)}
              </select>
            </label>
            {field("experience_end", "Fim da experiência", "date")}
            {field("aso_due", "Vencimento do ASO", "date")}
            {field("vacation_due", "Férias vencem em", "date")}
            {field("vacation_return", "Retorno de férias", "date")}
            {field("terminated_at", "Data de desligamento", "date")}
          </div>
          <label className="mt-3 block text-xs">
            <span className="mb-1 block font-medium text-zinc-600">Observações</span>
            <textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
          </label>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={save} disabled={saving} className={btnPrimary}>{saving ? "Salvando…" : "Salvar alterações"}</button>
            <p className="text-xs text-zinc-400">Nada é apagado: desligamento muda o status e mantém o histórico. Toda alteração fica na Auditoria.</p>
          </div>
        </div>
      )}
    </>
  );
}

function NewEmployee({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => Promise<void> }) {
  const [f, setF] = useState<Record<string, string>>({ status: "admissao" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm(`Confirma o cadastro de ${f.full_name || "este colaborador"}?`)) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/dp/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setErr(d.error ?? "Não foi possível cadastrar");
      await onCreated(d.employee.id);
    } finally {
      setBusy(false);
    }
  }
  const inp = (k: string, label: string, type = "text", required = false) => (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-zinc-600">{label}</span>
      <input required={required} type={type} value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
    </label>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-[#0b1f3a]">Novo colaborador</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">{inp("full_name", "Nome completo", "text", true)}</div>
          {inp("cpf", "CPF")}
          {inp("role_title", "Cargo", "text", true)}
          {inp("department", "Setor")}
          {inp("admitted_at", "Data de admissão", "date")}
          {inp("salary", "Salário base (R$)", "number")}
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-zinc-600">Situação</span>
            <select value={f.status} onChange={(e) => set("status", e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
              <option value="admissao">Admissão (com checklist)</option>
              <option value="experiencia">Experiência</option>
              <option value="ativo">Ativo</option>
            </select>
          </label>
          {inp("experience_end", "Fim da experiência", "date")}
          {inp("aso_due", "Vencimento do ASO", "date")}
          {inp("vacation_due", "Férias vencem em", "date")}
        </div>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm">Cancelar</button>
          <button type="submit" disabled={busy} className={btnPrimary}>{busy ? "Salvando…" : "Cadastrar"}</button>
        </div>
      </form>
    </div>
  );
}
