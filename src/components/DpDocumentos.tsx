"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DpEmployee } from "@/lib/dp";
import { ASO_RESULTADO_LABEL, ASO_RESULTADOS, ASO_TIPO_LABEL, ASO_TIPOS, DOC_KEYS } from "@/lib/dp-docs";

interface Aso {
  id: string;
  employee_id: string;
  tipo: string;
  exam_date: string;
  resultado: string;
  medico_nome: string | null;
  medico_crm: string | null;
  medico_uf: string | null;
  validade_meses: number | null;
  next_due: string | null;
  file_path: string | null;
  notes: string | null;
}
interface Doc { employee_id: string; doc_key: string; status: "entregue" | "pendente" | "na"; file_path: string | null }

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const diff = (a: string, b: string) => Math.round((new Date(a.slice(0, 10) + "T12:00:00Z").getTime() - new Date(b.slice(0, 10) + "T12:00:00Z").getTime()) / DAY);
const fmt = (d: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
const btn = "rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-[#06231f] hover:bg-teal-400 disabled:opacity-50";
const btn2 = "rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50 disabled:opacity-50";
const inp = "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm";

interface Situ { t: string; c: string; order: number }
function situacaoAso(aso: Aso | undefined): Situ {
  if (!aso) return { t: "Sem ASO", c: "bg-red-100 text-red-700", order: 0 };
  if (!aso.next_due) return { t: "Sem vencimento", c: "bg-zinc-100 text-zinc-600", order: 5 };
  const d = diff(aso.next_due, today());
  if (aso.resultado === "inapto") return { t: "Inapto", c: "bg-red-100 text-red-700", order: 0 };
  if (d < 0) return { t: `Vencido há ${-d} dias`, c: "bg-red-100 text-red-700", order: 0 };
  if (d <= 30) return { t: `Vence em ${d} dias`, c: "bg-amber-100 text-amber-800", order: 1 };
  return { t: "Em dia", c: "bg-emerald-100 text-emerald-800", order: 3 };
}

async function abrir(path: string, setMsg: (m: string) => void) {
  const r = await fetch(`/api/admin/dp/files?path=${encodeURIComponent(path)}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return setMsg(d.error ?? "Falha ao abrir o arquivo");
  window.open(d.url, "_blank", "noopener");
}

async function enviarArquivo(kind: "aso" | "doc", employeeId: string, ref: string, file: File) {
  const f = new FormData();
  f.set("kind", kind);
  f.set("employee_id", employeeId);
  f.set("ref", ref);
  f.set("file", file);
  const r = await fetch("/api/admin/dp/files", { method: "POST", body: f });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, error: d.error as string | undefined };
}

export default function DpDocumentos({ employees }: { employees: DpEmployee[] }) {
  const [asos, setAsos] = useState<Aso[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ emp: "", tipo: "periodico", date: "", resultado: "apto", medico: "", crm: "", uf: "", meses: "12", notes: "" });
  const [file, setFile] = useState<File | null>(null);
  const [docEmp, setDocEmp] = useState("");

  const load = useCallback(async () => {
    const [a, d] = await Promise.all([fetch("/api/admin/dp/asos"), fetch("/api/admin/dp/docs")]);
    const aj = await a.json().catch(() => ({}));
    const dj = await d.json().catch(() => ({}));
    if (a.ok) setAsos(aj.asos ?? []);
    else setMsg(aj.error ?? "Falha ao carregar ASO");
    if (d.ok) setDocs(dj.docs ?? []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const ativos = useMemo(() => employees.filter((e) => e.status !== "desligado"), [employees]);
  useEffect(() => {
    if (!docEmp && ativos.length) setDocEmp(ativos[0].id);
  }, [ativos, docEmp]);

  const ultimo = useCallback(
    (empId: string) => asos.filter((a) => a.employee_id === empId && a.tipo !== "demissional").sort((x, y) => y.exam_date.localeCompare(x.exam_date))[0],
    [asos],
  );
  const linhas = useMemo(
    () => ativos.map((e) => ({ e, aso: ultimo(e.id), s: situacaoAso(ultimo(e.id)) })).sort((a, b) => a.s.order - b.s.order || a.e.full_name.localeCompare(b.e.full_name)),
    [ativos, ultimo],
  );
  const vencidos = linhas.filter((l) => l.s.order === 0).length;
  const vencendo = linhas.filter((l) => l.s.order === 1).length;
  const emDia = linhas.filter((l) => l.s.order === 3).length;
  const status = (empId: string, key: string): Doc["status"] => docs.find((d) => d.employee_id === empId && d.doc_key === key)?.status ?? "pendente";
  const pendentes = ativos.reduce((s, e) => s + DOC_KEYS.filter(([k]) => status(e.id, k) === "pendente").length, 0);

  async function salvarAso() {
    setMsg(null);
    if (!form.emp || !form.date) return setMsg("Escolha o colaborador e a data do exame.");
    setBusy("aso");
    const r = await fetch("/api/admin/dp/asos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: form.emp, tipo: form.tipo, exam_date: form.date, resultado: form.resultado, medico_nome: form.medico, medico_crm: form.crm, medico_uf: form.uf, validade_meses: Number(form.meses), notes: form.notes }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setBusy(null);
      return setMsg(d.error ?? "Falha ao salvar");
    }
    if (file) {
      const up = await enviarArquivo("aso", form.emp, d.aso.id, file);
      if (!up.ok) setMsg(`ASO salvo, mas o arquivo não subiu: ${up.error ?? "erro"}`);
    }
    setBusy(null);
    setFile(null);
    setForm({ ...form, date: "", medico: "", crm: "", uf: "", notes: "" });
    await load();
  }

  async function anexarAso(a: Aso, f: File) {
    setBusy(a.id);
    const up = await enviarArquivo("aso", a.employee_id, a.id, f);
    setBusy(null);
    if (!up.ok) setMsg(up.error ?? "Falha ao enviar");
    await load();
  }

  async function marcar(empId: string, key: string, st: Doc["status"]) {
    const r = await fetch("/api/admin/dp/docs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employee_id: empId, doc_key: key, status: st }) });
    if (!r.ok) setMsg((await r.json().catch(() => ({}))).error ?? "Falha ao salvar");
    await load();
  }
  async function anexarDoc(empId: string, key: string, f: File) {
    setBusy(empId + key);
    const up = await enviarArquivo("doc", empId, key, f);
    setBusy(null);
    if (!up.ok) setMsg(up.error ?? "Falha ao enviar");
    await load();
  }

  const entregues = DOC_KEYS.filter(([k]) => status(docEmp, k) === "entregue").length;
  const aplicaveis = DOC_KEYS.filter(([k]) => status(docEmp, k) !== "na").length;

  return (
    <div className="space-y-4">
      {msg && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{msg}</p>}

      <div className="grid gap-3 sm:grid-cols-4">
        {[["ASO vencido ou ausente", vencidos, "text-red-700"], ["ASO vencendo em 30 dias", vencendo, "text-amber-700"], ["Documentos pendentes", pendentes, "text-amber-700"], ["ASO em dia", emDia, ""]].map(([l, n, c]) => (
          <div key={String(l)} className="rounded-xl border border-zinc-200 bg-white p-3">
            <div className={`text-2xl font-bold ${c}`}>{n}</div>
            <div className="text-xs text-zinc-500">{l}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#0b1f3a]">Controle de ASO (atestado de saúde ocupacional)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-left text-zinc-500"><th className="p-1.5">Colaborador</th><th className="p-1.5">Último ASO</th><th className="p-1.5">Tipo</th><th className="p-1.5">Resultado</th><th className="p-1.5">Próximo vencimento</th><th className="p-1.5">Situação</th><th className="p-1.5">Arquivo</th></tr></thead>
            <tbody>
              {linhas.map(({ e, aso, s }) => (
                <tr key={e.id} className="border-t border-zinc-100">
                  <td className="p-1.5 font-medium">{e.full_name}</td>
                  <td className="p-1.5">{fmt(aso?.exam_date ?? null)}</td>
                  <td className="p-1.5">{aso ? ASO_TIPO_LABEL[aso.tipo] ?? aso.tipo : "—"}</td>
                  <td className="p-1.5">{aso ? ASO_RESULTADO_LABEL[aso.resultado] ?? aso.resultado : "—"}</td>
                  <td className="p-1.5">{fmt(aso?.next_due ?? null)}</td>
                  <td className="p-1.5"><span className={`rounded-full px-2 py-0.5 ${s.c}`}>{s.t}</span></td>
                  <td className="p-1.5">
                    {aso?.file_path ? (
                      <button className={btn2} onClick={() => abrir(aso.file_path!, (m) => setMsg(m))}>Abrir</button>
                    ) : aso ? (
                      <label className={`${btn2} cursor-pointer`}>
                        {busy === aso.id ? "Enviando…" : "Anexar"}
                        <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(ev) => ev.target.files?.[0] && anexarAso(aso, ev.target.files[0])} />
                      </label>
                    ) : null}
                  </td>
                </tr>
              ))}
              {!linhas.length && <tr><td colSpan={7} className="p-3 text-zinc-400">Nenhum colaborador ativo.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-[#0b1f3a]">Registrar ASO</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs"><span className="mb-1 block font-medium text-zinc-600">Colaborador</span>
              <select className={inp} value={form.emp} onChange={(e) => setForm({ ...form, emp: e.target.value })}>
                <option value="">Selecione…</option>
                {ativos.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </select></label>
            <label className="block text-xs"><span className="mb-1 block font-medium text-zinc-600">Tipo</span>
              <select className={inp} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {ASO_TIPOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
            <label className="block text-xs"><span className="mb-1 block font-medium text-zinc-600">Data do exame</span>
              <input type="date" className={inp} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label className="block text-xs"><span className="mb-1 block font-medium text-zinc-600">Resultado</span>
              <select className={inp} value={form.resultado} onChange={(e) => setForm({ ...form, resultado: e.target.value })}>
                {ASO_RESULTADOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></label>
            <label className="block text-xs"><span className="mb-1 block font-medium text-zinc-600">Médico</span>
              <input className={inp} value={form.medico} onChange={(e) => setForm({ ...form, medico: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs"><span className="mb-1 block font-medium text-zinc-600">CRM</span>
                <input className={inp} value={form.crm} onChange={(e) => setForm({ ...form, crm: e.target.value })} /></label>
              <label className="block text-xs"><span className="mb-1 block font-medium text-zinc-600">UF</span>
                <input className={inp} maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })} /></label>
            </div>
            <label className="block text-xs"><span className="mb-1 block font-medium text-zinc-600">Validade</span>
              <select className={inp} value={form.meses} onChange={(e) => setForm({ ...form, meses: e.target.value })}>
                <option value="12">12 meses</option>
                <option value="24">24 meses (risco baixo, conforme NR-7)</option>
              </select></label>
            <label className="block text-xs"><span className="mb-1 block font-medium text-zinc-600">Arquivo do ASO (PDF/JPG/PNG, até 4 MB)</span>
              <input type="file" accept="application/pdf,image/jpeg,image/png" className="w-full text-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
            <label className="block text-xs sm:col-span-2"><span className="mb-1 block font-medium text-zinc-600">Observação</span>
              <input className={inp} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500">O próximo vencimento é calculado sozinho (ASO demissional não tem vencimento) e atualiza o alerta da ficha do colaborador.</p>
          <button className={`${btn} mt-3`} disabled={busy === "aso"} onClick={salvarAso}>{busy === "aso" ? "Salvando…" : "Salvar ASO"}</button>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-[#0b1f3a]">Documentos</h2>
            <select className="rounded-md border border-zinc-300 px-2 py-1 text-xs" value={docEmp} onChange={(e) => setDocEmp(e.target.value)}>
              {ativos.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
            {docEmp && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">{entregues} de {aplicaveis} entregues</span>}
          </div>
          <div className="space-y-1">
            {docEmp && DOC_KEYS.map(([k, l]) => {
              const st = status(docEmp, k);
              const d = docs.find((x) => x.employee_id === docEmp && x.doc_key === k);
              return (
                <div key={k} className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 py-1.5 text-xs">
                  <span>{l}</span>
                  <span className="flex items-center gap-1">
                    <select className="rounded-md border border-zinc-300 px-1.5 py-1 text-xs" value={st} onChange={(e) => marcar(docEmp, k, e.target.value as Doc["status"])}>
                      <option value="pendente">Pendente</option>
                      <option value="entregue">Entregue</option>
                      <option value="na">Não se aplica</option>
                    </select>
                    {d?.file_path && <button className={btn2} onClick={() => abrir(d.file_path!, (m) => setMsg(m))}>Abrir</button>}
                    {st !== "na" && (
                      <label className={`${btn2} cursor-pointer`}>
                        {busy === docEmp + k ? "Enviando…" : d?.file_path ? "Trocar" : "Anexar"}
                        <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(ev) => ev.target.files?.[0] && anexarDoc(docEmp, k, ev.target.files[0])} />
                      </label>
                    )}
                  </span>
                </div>
              );
            })}
            {!docEmp && <p className="text-xs text-zinc-400">Nenhum colaborador ativo.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
