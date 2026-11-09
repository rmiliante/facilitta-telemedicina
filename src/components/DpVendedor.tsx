"use client";

import { useEffect, useMemo, useState } from "react";

/* Dashboard do vendedor: quanto cada venda já rendeu (pagamentos do Asaas via Master) e se o vendedor se paga. */

type Cob = [string, string, number, string | null, string | null];
interface VendaRow { venda_id: string; vendedor: string; cliente: string; produto: string; data_venda: string | null; status: string; cobrancas: Cob[]; atualizado_em: string }

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const labelMes = (c: string) => MESES[Number(c.slice(5, 7)) - 1] + "/" + c.slice(2, 4);
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brl0 = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtD = (d: string | null) => (d ? d.slice(8, 10) + "/" + d.slice(5, 7) + "/" + d.slice(0, 4) : "—");
const inp = "rounded-md border border-zinc-300 px-2 py-1 text-sm";
const pago = (c: Cob) => c[1] === "RECEIVED" || c[1] === "CONFIRMED";
const r2 = (n: number) => Math.round(n * 100) / 100;
const hojeYm = () => new Date().toISOString().slice(0, 7);

function resumo(v: VendaRow) {
  let recebido = 0, aberto = 0, atraso = 0, ultimo = "", adesaoYm = "";
  for (const c of v.cobrancas ?? []) {
    if (pago(c)) {
      recebido += c[2];
      const d = c[4] || c[3] || "";
      if (d > ultimo) ultimo = d;
      if (c[0] === "adhesion" && !adesaoYm) adesaoYm = d.slice(0, 7);
    } else if (c[1] === "PENDING") aberto += c[2];
    else if (c[1] === "OVERDUE") atraso += c[2];
  }
  return { recebido: r2(recebido), aberto: r2(aberto), atraso: r2(atraso), ultimo, adesaoYm };
}

const nomeVend = (v: string, emailMichelle: string) => {
  if (v === emailMichelle) return "Michelle · " + v;
  if (v.toLowerCase().startsWith("rodrigo.")) return "Rodrigo · " + v;
  return v;
};

export interface VendedorProps {
  inicio: string;
  comissoesReais: Record<string, number>;
  custoFn: (ym: string, comissao: number) => number;
}

export default function DpVendedor({ inicio, comissoesReais, custoFn }: VendedorProps) {
  const [vendas, setVendas] = useState<VendaRow[]>([]);
  const [cfg, setCfg] = useState<{ vendedor: string; valor: number }>({ vendedor: "", valor: 20 });
  const [carregado, setCarregado] = useState(false);
  const [sel, setSel] = useState("");
  const [periodo, setPeriodo] = useState<"adm" | "todo">("adm");
  const [fStatus, setFStatus] = useState("");
  const [fMes, setFMes] = useState("");
  const [soAtraso, setSoAtraso] = useState(false);

  useEffect(() => {
    void (async () => {
      const [a, b] = await Promise.all([
        fetch("/api/admin/dp/vendas").then((r) => r.json().catch(() => ({}))),
        fetch("/api/admin/dp/comissoes").then((r) => r.json().catch(() => ({}))),
      ]);
      setVendas((a.vendas ?? []) as VendaRow[]);
      const c = b.config ?? {};
      setCfg({ vendedor: String(c.vendedor ?? ""), valor: Number(c.valor) || 20 });
      setCarregado(true);
    })();
  }, []);

  const emailM = cfg.vendedor.toLowerCase();
  const vendedores = useMemo(() => {
    const cont: Record<string, number> = {};
    for (const v of vendas) cont[v.vendedor] = (cont[v.vendedor] ?? 0) + 1;
    const lista = Object.entries(cont).sort((a, b) => b[1] - a[1]);
    const rodr = lista.filter(([k]) => k.toLowerCase().startsWith("rodrigo.")).reduce((s, [, n]) => s + n, 0);
    const out: { key: string; label: string }[] = [{ key: "__todos", label: "Todos os vendedores (" + vendas.length + ")" }];
    if (rodr) out.push({ key: "__rodrigo", label: "Rodrigo · todos os e-mails (" + rodr + ")" });
    for (const [k, n] of lista) out.push({ key: k, label: nomeVend(k, emailM) + " (" + n + ")" });
    return out;
  }, [vendas, emailM]);

  const selAtual = sel || (vendas.some((v) => v.vendedor.toLowerCase() === emailM) ? vendas.find((v) => v.vendedor.toLowerCase() === emailM)!.vendedor : "__todos");
  const ehMichelle = selAtual.toLowerCase() === emailM && emailM !== "";
  const per = ehMichelle ? periodo : "todo";

  const filtradas = useMemo(() => vendas.filter((v) => {
    const k = v.vendedor.toLowerCase();
    if (selAtual === "__rodrigo" ? !k.startsWith("rodrigo.") : selAtual !== "__todos" && v.vendedor !== selAtual) return false;
    if (per === "adm" && (v.data_venda ?? "") < inicio) return false;
    return true;
  }), [vendas, selAtual, per, inicio]);

  const linhas = useMemo(() => filtradas.map((v) => ({ v, r: resumo(v) })), [filtradas]);

  const kpi = useMemo(() => {
    let rec = 0, ab = 0, at = 0, ativas = 0, cancel = 0, desist = 0, naoPaga = 0;
    for (const { v, r } of linhas) {
      rec += r.recebido; ab += r.aberto; at += r.atraso;
      if (v.status === "Ativo" || v.status === "Adesão paga") ativas++;
      else if (v.status === "Cancelado") cancel++;
      else if (v.status === "Desistido") desist++;
      else naoPaga++;
    }
    return { rec: r2(rec), ab: r2(ab), at: r2(at), ativas, cancel, desist, naoPaga, n: linhas.length };
  }, [linhas]);

  // recebido por mês de pagamento + custo (só para a Michelle desde a admissão)
  const meses = useMemo(() => {
    const rec: Record<string, number> = {}, adesoes: Record<string, number> = {}, vendasMes: Record<string, number> = {};
    for (const { v, r } of linhas) {
      for (const c of v.cobrancas ?? []) if (pago(c)) { const m = (c[4] || c[3] || "").slice(0, 7); if (m) rec[m] = r2((rec[m] ?? 0) + c[2]); }
      if (r.adesaoYm) adesoes[r.adesaoYm] = (adesoes[r.adesaoYm] ?? 0) + 1;
      const vm = (v.data_venda ?? "").slice(0, 7);
      if (vm) vendasMes[vm] = (vendasMes[vm] ?? 0) + 1;
    }
    const chaves = [...new Set([...Object.keys(rec), ...Object.keys(vendasMes)])].sort();
    const comCusto = ehMichelle && per === "adm";
    const atual = hojeYm();
    return chaves.map((ym) => {
      let custo: number | null = null;
      let comEst = false;
      if (comCusto && ym >= inicio.slice(0, 7) && ym < atual) {
        const real = comissoesReais[ym];
        const com = real !== undefined ? real : r2((adesoes[ym] ?? 0) * cfg.valor);
        comEst = real === undefined;
        custo = r2(custoFn(ym, com));
      }
      return { ym, recebido: rec[ym] ?? 0, vendas: vendasMes[ym] ?? 0, adesoes: adesoes[ym] ?? 0, custo, comEst, parcial: ym >= atual };
    });
  }, [linhas, ehMichelle, per, inicio, comissoesReais, custoFn, cfg.valor]);

  const totCusto = meses.reduce((s, m) => s + (m.custo ?? 0), 0);
  const totRecFechado = meses.filter((m) => m.custo !== null).reduce((s, m) => s + m.recebido, 0);
  const temCusto = meses.some((m) => m.custo !== null);
  const resultado = r2(totRecFechado - totCusto);

  const statusLista = useMemo(() => [...new Set(filtradas.map((v) => v.status))].sort(), [filtradas]);
  const mesesVenda = useMemo(() => [...new Set(filtradas.map((v) => (v.data_venda ?? "").slice(0, 7)).filter(Boolean))].sort().reverse(), [filtradas]);
  const tabela = useMemo(() => linhas
    .filter(({ v, r }) => (!fStatus || v.status === fStatus) && (!fMes || (v.data_venda ?? "").startsWith(fMes)) && (!soAtraso || r.atraso > 0))
    .sort((a, b) => Number(b.v.venda_id) - Number(a.v.venda_id)), [linhas, fStatus, fMes, soAtraso]);
  const tot = tabela.reduce((s, { r }) => ({ rec: s.rec + r.recebido, ab: s.ab + r.aberto, at: s.at + r.atraso }), { rec: 0, ab: 0, at: 0 });

  const atualizado = vendas.reduce((m, v) => (v.atualizado_em > m ? v.atualizado_em : m), "");

  if (!carregado) return <p className="text-sm text-zinc-500">Carregando dashboard do vendedor…</p>;
  if (!vendas.length) return <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">Ainda não há vendas do Master carregadas para o dashboard do vendedor.</div>;

  const maxV = Math.max(1, ...meses.map((m) => Math.max(m.recebido, m.custo ?? 0)));
  const W = 860, H = 190, base = 160, hh = 130;
  const bw = Math.min(40, (W - 70) / Math.max(1, meses.length) / 2.4);
  const passo = (W - 70) / Math.max(1, meses.length);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-teal-300 bg-white p-4">
        <h2 className="text-sm font-semibold text-[#0b1f3a]">O vendedor se paga? · quanto cada venda já rendeu</h2>
        <p className="mb-3 text-xs text-zinc-500">Pagamentos recebidos no Asaas (via Master), valores brutos: sem taxa do Asaas nem custo do plano e dos prestadores. Dados do Master em {atualizado ? fmtD(atualizado) + " " + atualizado.slice(11, 16) : "—"}.</p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="text-xs text-zinc-600">Vendedor <select className={inp} value={selAtual} onChange={(e) => { setSel(e.target.value); setFStatus(""); setFMes(""); }}>{vendedores.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select></label>
          {ehMichelle && (
            <label className="text-xs text-zinc-600">Período <select className={inp} value={periodo} onChange={(e) => setPeriodo(e.target.value as "adm" | "todo")}><option value="adm">Desde a admissão ({fmtD(inicio)})</option><option value="todo">Todo o período</option></select></label>
          )}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Vendas", String(kpi.n), kpi.ativas + " ativas · " + kpi.cancel + " canc. · " + kpi.desist + " desist.", ""],
            ["Recebido", brl0(kpi.rec), kpi.n ? brl0(kpi.rec / kpi.n) + " por venda" : "", "text-emerald-700"],
            ["Em atraso", brl0(kpi.at), "cobranças vencidas", kpi.at > 0 ? "text-red-700" : ""],
            ["A vencer", brl0(kpi.ab), "cobranças em aberto", ""],
            ["Vendas ativas", kpi.n ? Math.round((kpi.ativas / kpi.n) * 100) + "%" : "—", kpi.naoPaga + " sem adesão paga", ""],
            temCusto ? ["Resultado", (resultado >= 0 ? "+" : "") + brl0(resultado), "recebido − custo (meses fechados)", resultado >= 0 ? "text-emerald-700" : "text-red-700"] : ["Custo", "—", "só calculado para a Michelle", ""],
          ].map(([t, v, s, c]) => (
            <div key={t} className="rounded-lg border border-zinc-200 p-2.5"><div className="text-xs text-zinc-500">{t}</div><div className={"text-lg font-semibold " + c}>{v}</div><div className="text-[11px] text-zinc-400">{s}</div></div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-[#0b1f3a]">Recebido por mês{temCusto ? " x custo estimado" : ""}</h3>
        <svg viewBox={"0 0 " + W + " " + H} className="w-full" role="img" aria-label="Recebido por mês">
          {[0, 0.5, 1].map((f) => (<g key={f}><line x1={55} x2={W} y1={base - f * hh} y2={base - f * hh} stroke="#eee" /><text x={0} y={base - f * hh + 4} fontSize="11" fill="#71717a">{brl0(maxV * f)}</text></g>))}
          {meses.map((m, i) => {
            const x = 70 + i * passo;
            const h1 = (m.recebido / maxV) * hh, h2 = ((m.custo ?? 0) / maxV) * hh;
            return (
              <g key={m.ym}>
                <rect x={x} y={base - h1} width={bw} height={h1} rx={4} fill="#14b8a6" opacity={m.parcial ? 0.5 : 1}><title>{labelMes(m.ym) + " · recebido " + brl(m.recebido)}</title></rect>
                {m.custo !== null && <rect x={x + bw + 3} y={base - h2} width={bw} height={h2} rx={4} fill="#52525b"><title>{labelMes(m.ym) + " · custo " + brl(m.custo)}</title></rect>}
                <text x={x + bw} y={base + 15} fontSize="11" fill="#71717a" textAnchor="middle">{labelMes(m.ym)}{m.parcial ? "*" : ""}</text>
              </g>
            );
          })}
        </svg>
        <p className="text-[11px] text-zinc-400"><span className="text-teal-600">■</span> recebido {temCusto && <><span className="ml-2 text-zinc-600">■</span> custo estimado</>} · * mês em curso (parcial)</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left text-xs text-zinc-600"><tr><th className="p-2">Mês</th><th>Vendas feitas</th><th>Adesões pagas</th><th className="text-right">Recebido</th>{temCusto && <th className="text-right">Custo est.</th>}{temCusto && <th className="text-right">Resultado</th>}</tr></thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.ym} className="border-t border-zinc-100">
                  <td className="p-2">{labelMes(m.ym)}{m.parcial ? "*" : ""}</td><td>{m.vendas}</td><td>{m.adesoes}</td><td className="text-right">{brl(m.recebido)}</td>
                  {temCusto && <td className="text-right">{m.custo === null ? "—" : brl(m.custo) + (m.comEst ? " ~" : "")}</td>}
                  {temCusto && <td className={"text-right font-medium " + (m.custo === null ? "" : m.recebido - m.custo >= 0 ? "text-emerald-700" : "text-red-700")}>{m.custo === null ? "—" : (m.recebido - m.custo >= 0 ? "+" : "") + brl(m.recebido - m.custo)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {temCusto && <p className="mt-2 text-xs text-zinc-500">Custo estimado = salário + comissão + DSR + FGTS (8%) + INSS patronal (20%). Meses com “~” usam a comissão estimada pela regra (R$ {cfg.valor.toFixed(2).replace(".", ",")} por adesão paga no mês) porque a comissão real não foi informada. Ajustes finos (RAT, terceiros, férias e 13º) ficam com o contador.</p>}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-[#0b1f3a]">Vendas e o que cada uma já rendeu</h3>
        <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
          <label>Status <select className={inp} value={fStatus} onChange={(e) => setFStatus(e.target.value)}><option value="">Todos</option>{statusLista.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label>Mês da venda <select className={inp} value={fMes} onChange={(e) => setFMes(e.target.value)}><option value="">Todos</option>{mesesVenda.map((m) => <option key={m} value={m}>{labelMes(m)}</option>)}</select></label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={soAtraso} onChange={(e) => setSoAtraso(e.target.checked)} />Só com atraso</label>
          <span className="ml-auto">{tabela.length} venda(s)</span>
        </div>
        <div className="max-h-[480px] overflow-auto rounded-lg border border-zinc-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-100 text-left text-xs text-zinc-600"><tr><th className="p-2">ID</th><th>Cliente</th><th>Venda</th><th>Status</th><th className="text-right">Recebido</th><th className="text-right">A vencer</th><th className="text-right">Em atraso</th><th>Último pgto</th></tr></thead>
            <tbody>
              {tabela.slice(0, 400).map(({ v, r }) => (
                <tr key={v.venda_id} className="border-t border-zinc-100">
                  <td className="p-2">#{v.venda_id}</td><td>{v.cliente}</td><td>{fmtD(v.data_venda)}</td><td>{v.status}</td>
                  <td className="text-right text-emerald-700">{brl(r.recebido)}</td><td className="text-right">{r.aberto ? brl(r.aberto) : "—"}</td><td className={"text-right " + (r.atraso ? "font-medium text-red-700" : "")}>{r.atraso ? brl(r.atraso) : "—"}</td><td>{fmtD(r.ultimo || null)}</td>
                </tr>
              ))}
              <tr className="sticky bottom-0 border-t-2 border-zinc-300 bg-zinc-50 font-semibold"><td className="p-2" colSpan={4}>Total filtrado</td><td className="text-right">{brl(tot.rec)}</td><td className="text-right">{brl(tot.ab)}</td><td className="text-right">{brl(tot.at)}</td><td /></tr>
            </tbody>
          </table>
        </div>
        {tabela.length > 400 && <p className="mt-1 text-xs text-zinc-400">Mostrando as 400 vendas mais recentes; use os filtros para refinar.</p>}
      </div>
    </div>
  );
}
