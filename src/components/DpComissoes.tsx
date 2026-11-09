"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DpEmployee } from "@/lib/dp";

/* Comissões de vendas (importa o arquivo exportado do Master) + evolução mensal. */

interface Venda { competencia: string; venda_id: string; cliente: string | null; status: string | null; vendedor: string | null; adesao_paga_em: string | null; conta: boolean; motivo: string | null }
interface Config { valor: number; vendedor: string; employee_id: string }

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const labelComp = (c: string) => MESES[Number(c.slice(5, 7)) - 1] + "/" + c.slice(2, 4);
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const inp = "rounded-md border border-zinc-300 px-2 py-1 text-sm";
const btn = "rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-[#06231f] hover:bg-teal-400 disabled:opacity-50";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function splitCsv(text: string): string[][] {
  const first = text.split("\n")[0] ?? "";
  const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let cur: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { cur.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; cur.push(cell); cell = ""; if (cur.some((c) => c.trim())) rows.push(cur); cur = []; }
    else cell += ch;
  }
  cur.push(cell);
  if (cur.some((c) => c.trim())) rows.push(cur);
  return rows;
}

function toIso(s: string): string {
  const t = s.trim();
  const br = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return br[3] + "-" + br[2] + "-" + br[1];
  const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  return iso ? iso[0] : "";
}

function lerArquivo(text: string): { vendas: { venda_id: string; cliente: string; status: string; vendedor: string; adesao_paga_em: string }[]; erro: string | null } {
  const rows = splitCsv(text.replace(/^﻿/, ""));
  if (rows.length < 2) return { vendas: [], erro: "Arquivo vazio ou sem linhas." };
  const h = rows[0].map(norm);
  const col = (...nomes: string[]) => h.findIndex((x) => nomes.some((n) => x.includes(n)));
  const iId = col("venda", "#", "id");
  const iCli = col("cliente", "nome", "paciente");
  const iSt = col("status");
  const iVend = col("vendedor", "codigo", "email");
  let iData = col("adesao paga", "pago em", "data pag", "adesao");
  if (iData < 0) iData = col("data");
  if (iId < 0 || iSt < 0 || iVend < 0 || iData < 0) return { vendas: [], erro: "Não encontrei as colunas Venda, Status, Vendedor e Data da adesão paga. Colunas lidas: " + rows[0].join(" | ") };
  const vendas = rows.slice(1).map((r) => ({ venda_id: (r[iId] ?? "").trim(), cliente: iCli >= 0 ? (r[iCli] ?? "").trim() : "", status: (r[iSt] ?? "").trim(), vendedor: (r[iVend] ?? "").trim(), adesao_paga_em: toIso(r[iData] ?? "") }));
  return { vendas, erro: null };
}

function mesAtual() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

export default function DpComissoes({ employees, onSaved }: { employees: DpEmployee[]; onSaved: () => void }) {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [cfg, setCfg] = useState<Config>({ valor: 20, vendedor: "", employee_id: "" });
  const [comp, setComp] = useState(mesAtual());
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/dp/comissoes");
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      setVendas(d.vendas ?? []);
      if (d.config) setCfg(d.config as Config);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const comps = useMemo(() => {
    const s = new Set<string>(vendas.map((v) => v.competencia));
    s.add(mesAtual());
    return [...s].sort().reverse();
  }, [vendas]);
  const doMes = vendas.filter((v) => v.competencia === comp);
  const contadas = doMes.filter((v) => v.conta);

  const evolucao = useMemo(() => {
    const m: Record<string, number> = {};
    for (const v of vendas) if (v.conta) m[v.competencia] = (m[v.competencia] ?? 0) + 1;
    return Object.keys(m).sort().map((c) => ({ comp: c, qtd: m[c], valor: m[c] * cfg.valor }));
  }, [vendas, cfg.valor]);
  const max = Math.max(1, ...evolucao.map((e) => e.qtd));
  const acumulado = evolucao.reduce((s, e) => s + e.valor, 0);
  const melhor = evolucao.reduce((a, e) => (e.qtd > a.qtd ? e : a), { comp: "", qtd: 0, valor: 0 });

  async function importar(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    const { vendas: lidas, erro } = lerArquivo(await file.text());
    if (erro) { setMsg(erro); return; }
    if (!cfg.employee_id || !cfg.vendedor.trim()) { setMsg("Escolha o colaborador e informe o e-mail/código do vendedor."); return; }
    setBusy(true);
    const r = await fetch("/api/admin/dp/comissoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ competencia: comp, employee_id: cfg.employee_id, valor_por_venda: cfg.valor, vendedor: cfg.vendedor, vendas: lidas }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(d.error ?? "Falha ao importar"); return; }
    setMsg(d.qtd + " venda(s) contadas, " + d.desconsideradas + " desconsideradas. Comissão de " + labelComp(comp) + ": " + brl(d.total) + " (já lançada na folha).");
    await load();
    onSaved();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-[#0b1f3a]">Comissões de vendas · {labelComp(comp)}</h2>
        <p className="mb-3 text-xs text-zinc-500">Conta a venda com status Ativo ou Adesão paga, do vendedor informado, com a adesão paga dentro do mês.</p>
        <div className="grid gap-2 md:grid-cols-4">
          <label className="text-xs text-zinc-600">Competência
            <select className={inp + " w-full"} value={comp} onChange={(e) => setComp(e.target.value)}>{comps.map((c) => <option key={c} value={c}>{labelComp(c)}</option>)}</select>
          </label>
          <label className="text-xs text-zinc-600">Colaborador
            <select className={inp + " w-full"} value={cfg.employee_id} onChange={(e) => setCfg({ ...cfg, employee_id: e.target.value })}>
              <option value="">Escolha…</option>
              {employees.filter((e) => e.salary).map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </label>
          <label className="text-xs text-zinc-600">Vendedor (e-mail/código no Master)
            <input className={inp + " w-full"} value={cfg.vendedor} onChange={(e) => setCfg({ ...cfg, vendedor: e.target.value })} />
          </label>
          <label className="text-xs text-zinc-600">Valor por venda (R$)
            <input type="number" step="0.01" className={inp + " w-full"} value={cfg.valor} onChange={(e) => setCfg({ ...cfg, valor: Number(e.target.value) })} />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className={btn + " cursor-pointer"}>{busy ? "Importando…" : "⬆ Importar arquivo (CSV do Master)"}
            <input type="file" accept=".csv,text/csv,.txt" className="hidden" disabled={busy} onChange={(e) => { void importar(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <span className="text-xs text-zinc-500">Importar de novo substitui as vendas desta competência.</span>
        </div>
        {msg && <p className="mt-3 rounded-md bg-zinc-100 p-2 text-sm text-zinc-700">{msg}</p>}
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {([["Vendas no mês", String(contadas.length)], ["Valor por venda", brl(cfg.valor)], ["Comissão do mês", brl(contadas.length * cfg.valor)], ["Desconsideradas", String(doMes.length - contadas.length)]] as const).map(([l, v]) => (
            <div key={l} className="rounded-lg border border-zinc-200 p-3"><div className="text-xs text-zinc-500">{l}</div><div className="text-lg font-semibold text-[#0b1f3a]">{v}</div></div>
          ))}
        </div>
        {doMes.length > 0 && (
          <table className="mt-3 w-full text-xs">
            <thead className="bg-zinc-100 text-left text-zinc-600"><tr><th className="p-2">Venda</th><th>Cliente</th><th>Status</th><th>Adesão paga em</th><th>Conta?</th></tr></thead>
            <tbody>
              {doMes.map((v) => (
                <tr key={v.venda_id} className="border-t border-zinc-100">
                  <td className="p-2">#{v.venda_id}</td><td>{v.cliente || "—"}</td><td>{v.status}</td><td>{v.adesao_paga_em ? v.adesao_paga_em.split("-").reverse().join("/") : "—"}</td>
                  <td>{v.conta ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">Sim</span> : <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800">Não · {v.motivo}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-[#0b1f3a]">Evolução de vendas e comissão</h2>
        <p className="mb-3 text-xs text-zinc-500">Meses já importados. Cada importação mensal acrescenta uma barra.</p>
        {evolucao.length === 0 ? <p className="text-sm text-zinc-400">Sem dados ainda.</p> : (
          <>
            <div className="flex items-end gap-3" style={{ height: 160 }}>
              {evolucao.map((e) => (
                <div key={e.comp} className="flex flex-1 flex-col items-center justify-end gap-1" title={brl(e.valor)}>
                  <span className="text-xs font-semibold text-[#0b1f3a]">{e.qtd}</span>
                  <div className="w-full max-w-[64px] rounded-t bg-teal-500" style={{ height: Math.max(6, (e.qtd / max) * 120) }} />
                  <span className="text-xs text-zinc-500">{labelComp(e.comp)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg border border-zinc-200 p-3"><div className="text-xs text-zinc-500">Comissão acumulada</div><b>{brl(acumulado)}</b></div>
              <div className="rounded-lg border border-zinc-200 p-3"><div className="text-xs text-zinc-500">Média mensal</div><b>{brl(acumulado / evolucao.length)}</b></div>
              <div className="rounded-lg border border-zinc-200 p-3"><div className="text-xs text-zinc-500">Melhor mês</div><b>{melhor.comp ? labelComp(melhor.comp) + " · " + melhor.qtd + " vendas" : "—"}</b></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
