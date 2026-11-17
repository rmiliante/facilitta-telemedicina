"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

/** Dashboard > Prescrições: o que já foi prescrito (receitas, exames, atestados, APAC). */

interface Item {
  name: string;
  count: number;
}
interface MedDetalhe {
  name: string;
  count: number;
  pacientes: number;
  medicos: number;
  ultima: string | null;
  posologia: string | null;
  tipoKey: string;
  tipo: string;
  info: { classe: string; uso: string; serve: string; atencao: string } | null;
  precos: { concentracao: string; forma: string; caixa: number | null; unidadeMin: number | null; unidadeMed: number | null }[];
}
interface Stats {
  medicamentosDetalhe: MedDetalhe[];
  resumoMeds: {
    totalItens: number;
    receitas: number;
    pacientes: number;
    maxItensReceita: number;
    distintos: number;
    top5Pct: number | null;
    controlados: number;
    controladosPct: number | null;
    itensPorReceita: number | null;
    itensPorPaciente: number | null;
    valorEstimado: number | null;
    valorPorReceita: number | null;
    itensComPrecoPct: number | null;
    cmedRef: string | null;
    classes: Item[];
    porMedico: { name: string; itens: number; itensPorReceita: number; controladosPct: number }[];
    porMes: { mes: string; count: number }[];
  };
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
const TIPO_BADGE: Record<string, string> = {
  simples: "bg-teal-50 text-teal-700",
  controle_especial: "bg-amber-100 text-amber-800",
  antimicrobiano: "bg-indigo-100 text-indigo-700",
  glp1: "bg-rose-100 text-rose-700",
  notificacao: "bg-zinc-200 text-zinc-700",
};
const TIPO_REGRA: Record<string, string> = {
  simples: "Receita simples (branca).",
  controle_especial: "Exige receita de controle especial em 2 vias (Portaria 344/98, lista C1), emitida pelo SNCR com numeração.",
  antimicrobiano: "Receita com retenção na farmácia (RDC 471/2021), emitida pelo SNCR.",
  glp1: "Receita com retenção na farmácia, emitida pelo SNCR.",
  notificacao: "Exige Notificação de Receita (A/B). Não é emitida por este sistema.",
};
const fieldCls =
  "rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-xs text-zinc-800 outline-none focus:border-brand-teal-dark";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function br(day: string) {
  return day.split("-").reverse().join("/");
}

const brl = (v: number | null | undefined, dec = 2) => (v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: dec, maximumFractionDigits: dec }));
const FORMA: Record<string, string> = { COM: "comprimido", CAP: "cápsula", DRG: "drágea", "SOL OR": "solução oral", "SUS OR": "suspensão oral", XPE: "xarope", INJ: "injetável", GOT: "gotas", ENV: "envelope", CAN: "caneta" };
function mesBr(m: string) {
  const [y, mm] = m.split("-");
  return `${["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][Number(mm) - 1]}/${y.slice(2)}`;
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
function Bars({ items, colors, onPick }: { items: Item[]; colors?: (i: Item, idx: number) => string; onPick?: (i: Item) => void }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (items.length === 0) return <p className="text-xs text-zinc-400">Sem dados no período.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((i, idx) => (
        <li
          key={i.name}
          className={`flex items-center gap-2 text-xs ${onPick ? "cursor-pointer rounded hover:bg-zinc-50" : ""}`}
          onClick={
            onPick
              ? (e) => {
                  e.stopPropagation();
                  onPick(i);
                }
              : undefined
          }
        >
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

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-navy/50 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between bg-brand-navy px-5 py-4 text-white">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            {subtitle && <p className="text-xs opacity-80">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="text-xl leading-none">
            ✕
          </button>
        </div>
        <div className="space-y-3 px-5 py-4 text-sm text-zinc-700">{children}</div>
      </div>
    </div>
  );
}
function Label({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{children}</p>;
}

function MedPopup({ med, cmedRef, onClose }: { med: MedDetalhe; cmedRef: string | null; onClose: () => void }) {
  return (
    <Modal title={med.name} subtitle={med.info ? `${med.info.classe} · uso ${med.info.uso}` : undefined} onClose={onClose}>
      <div className="flex flex-wrap gap-1.5">
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TIPO_BADGE[med.tipoKey]}`}>{med.tipo}</span>
      </div>
      {med.info && (
        <div>
          <Label>Para que serve</Label>
          <p>{med.info.serve}</p>
        </div>
      )}
      <div>
        <Label>Receita</Label>
        <p>{TIPO_REGRA[med.tipoKey]}</p>
      </div>
      {med.info && (
        <div>
          <Label>Atenção</Label>
          <p>{med.info.atencao}</p>
        </div>
      )}
      {med.precos.length > 0 && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-700">Preço máximo ao consumidor (CMED{cmedRef ? ` · tabela de ${cmedRef.split("-").reverse().join("/")}` : ""})</p>
          <table className="mt-1 w-full text-xs">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="font-medium">Apresentação</th>
                <th className="text-right font-medium">Menor caixa</th>
                <th className="text-right font-medium">Por unidade</th>
              </tr>
            </thead>
            <tbody>
              {med.precos.map((p, i) => (
                <tr key={i} className="border-t border-teal-100">
                  <td className="py-1">
                    {p.concentracao.toLowerCase()} · {FORMA[p.forma] ?? p.forma.toLowerCase()}
                  </td>
                  <td className="py-1 text-right tabular-nums">{brl(p.caixa)}</td>
                  <td className="py-1 text-right tabular-nums">{p.unidadeMin != null && p.unidadeMed != null ? `${brl(p.unidadeMin)}–${brl(p.unidadeMed)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[10px] text-zinc-500">Preço teto (PMC, ICMS 18%); a farmácia pode cobrar menos. &quot;Por unidade&quot; = menor valor – valor mediano entre as marcas.</p>
        </div>
      )}
      <div className="rounded-lg bg-zinc-100 p-3">
        <Label>Na Facilitta</Label>
        <div className="mt-1 flex gap-5">
          {[
            [med.count, "prescrições"],
            [med.pacientes, "pacientes"],
            [med.medicos, "médicos"],
            [med.ultima ? new Date(med.ultima).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }) : "—", "última"],
          ].map(([v, l]) => (
            <div key={l as string}>
              <p className="text-lg font-semibold text-brand-navy">{v}</p>
              <p className="text-[11px]">{l}</p>
            </div>
          ))}
        </div>
        {med.posologia && (
          <p className="mt-2 text-xs">
            Posologia mais comum: <i>{med.posologia}</i>
          </p>
        )}
      </div>
      <p className="text-[10px] text-zinc-400">Informação de referência; não substitui a bula nem o julgamento médico.</p>
    </Modal>
  );
}

function ResumoPopup({ data, onClose, onPick }: { data: Stats; onClose: () => void; onPick: (m: MedDetalhe) => void }) {
  const r = data.resumoMeds;
  const tipos = data.tiposReceita;
  const totalTipos = tipos.reduce((t, x) => t + x.count, 0) || 1;
  const maxClasse = Math.max(1, ...r.classes.map((c) => c.count));
  return (
    <Modal title="Resumo dos medicamentos" subtitle={`${r.totalItens} itens prescritos no período`} onClose={onClose}>
      <div className="grid grid-cols-3 gap-2">
        {[
          [r.distintos, "medicamentos distintos"],
          [r.controladosPct === null ? "—" : `${r.controladosPct}%`, "controlados ou retidos"],
          [r.itensPorReceita ?? "—", "itens por receita"],
        ].map(([v, l]) => (
          <div key={l as string} className="rounded-lg bg-zinc-100 p-2.5">
            <p className="text-xl font-semibold text-brand-navy">{v}</p>
            <p className="text-[11px]">{l}</p>
          </div>
        ))}
      </div>
      {tipos.length > 0 && (
        <div>
          <Label>Por tipo de receita</Label>
          <div className="mt-1 flex h-3 overflow-hidden rounded-full">
            {tipos.map((t) => (
              <div key={t.key} className={TIPO_COLOR[t.key]} style={{ flexGrow: t.count, flexBasis: 0 }} title={`${t.name}: ${t.count}`} />
            ))}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 text-[11px]">
            {tipos.map((t) => (
              <span key={t.key}>
                {t.name} {Math.round((t.count / totalTipos) * 100)}%
              </span>
            ))}
          </p>
        </div>
      )}
      {r.classes.length > 0 && (
        <div>
          <Label>Por classe terapêutica</Label>
          <ul className="mt-1 space-y-1">
            {r.classes.map((c) => (
              <li key={c.name} className="flex items-center gap-2 text-xs">
                <span className="w-44 shrink-0 truncate" title={c.name}>
                  {c.name}
                </span>
                <span className="h-2 flex-1 rounded-full bg-zinc-100">
                  <span className="block h-2 rounded-full bg-brand-navy" style={{ width: `${(c.count / maxClasse) * 100}%` }} />
                </span>
                <span className="w-7 text-right tabular-nums">{c.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <Label>Todos os medicamentos (clique para detalhes)</Label>
        <table className="mt-1 w-full text-xs">
          <thead>
            <tr className="text-left text-zinc-500">
              <th className="font-medium">Medicamento</th>
              <th className="font-medium">Tipo</th>
              <th className="text-right font-medium">Prescr.</th>
              <th className="text-right font-medium">Pacientes</th>
            </tr>
          </thead>
          <tbody>
            {data.medicamentosDetalhe.map((m) => (
              <tr key={m.name} className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50" onClick={() => onPick(m)}>
                <td className="py-1">{m.name}</td>
                <td className="py-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TIPO_BADGE[m.tipoKey]}`}>{m.tipo}</span>
                </td>
                <td className="py-1 text-right tabular-nums">{m.count}</td>
                <td className="py-1 text-right tabular-nums">{m.pacientes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export default function PrescricoesDashboard() {
  const [popup, setPopup] = useState<{ tipo: "resumo" } | { tipo: "med"; med: MedDetalhe; voltar: boolean } | null>(null);
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

          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Medicamentos prescritos · no período filtrado</p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <Kpi label="Itens prescritos (soma)" value={data.resumoMeds.totalItens} hint={`em ${data.resumoMeds.receitas} receitas`} />
              <Kpi label="Média de itens por receita" value={data.resumoMeds.itensPorReceita ?? "—"} hint={data.resumoMeds.maxItensReceita ? `máx. ${data.resumoMeds.maxItensReceita} em uma receita` : undefined} />
              <Kpi label="Média por paciente" value={data.resumoMeds.itensPorPaciente ?? "—"} hint={`${data.resumoMeds.pacientes} pacientes`} />
              <Kpi label="Medicamentos distintos" value={data.resumoMeds.distintos} hint={data.resumoMeds.top5Pct != null ? `top 5 = ${data.resumoMeds.top5Pct}% dos itens` : undefined} />
              <Kpi label="Controlados ou retidos" value={data.resumoMeds.controladosPct == null ? "—" : `${data.resumoMeds.controladosPct}%`} hint={`${data.resumoMeds.controlados} itens`} />
              <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                <p className="text-xs font-medium text-teal-700">Valor estimado (teto CMED)</p>
                <p className="mt-1 text-2xl font-semibold text-brand-navy">{brl(data.resumoMeds.valorEstimado, 0)}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">
                  {data.resumoMeds.valorPorReceita != null ? `média ${brl(data.resumoMeds.valorPorReceita, 0)} por receita · ` : ""}
                  {data.resumoMeds.itensComPrecoPct ?? 0}% dos itens com preço
                </p>
              </div>
            </div>
            <p className="mt-1 text-[10px] text-zinc-400">Valor: quantidade × preço por unidade quando a receita traz o número; senão, 1 caixa (menor preço da dose). Preço teto, não o que o paciente paga.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Medicamentos por médico">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-zinc-500">
                    <th className="pb-1 font-medium">Médico</th>
                    <th className="pb-1 text-right font-medium">Itens</th>
                    <th className="pb-1 text-right font-medium">Itens/receita</th>
                    <th className="pb-1 text-right font-medium">% controlados</th>
                  </tr>
                </thead>
                <tbody>
                  {data.resumoMeds.porMedico.map((m) => (
                    <tr key={m.name} className="border-t border-zinc-100">
                      <td className="py-1 text-zinc-700">{m.name}</td>
                      <td className="py-1 text-right tabular-nums">{m.itens}</td>
                      <td className="py-1 text-right tabular-nums">{m.itensPorReceita}</td>
                      <td className="py-1 text-right tabular-nums">{m.controladosPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
            <Card title="Itens prescritos por mês">
              {data.resumoMeds.porMes.length === 0 ? (
                <p className="text-xs text-zinc-400">Sem dados no período.</p>
              ) : (
                <div className="flex h-28 items-end gap-2">
                  {data.resumoMeds.porMes.map((m) => (
                    <div key={m.mes} className="flex flex-1 flex-col items-center gap-1">
                      <span className="text-[10px] tabular-nums text-zinc-500">{m.count}</span>
                      <div className="w-full rounded-t bg-brand-navy" style={{ height: `${(m.count / Math.max(...data.resumoMeds.porMes.map((x) => x.count))) * 100}%` }} />
                      <span className="text-[10px] text-zinc-500">{mesBr(m.mes)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
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
            <div className="cursor-pointer" onClick={() => setPopup({ tipo: "resumo" })} title="Clique para ver o resumo de todos os medicamentos">
              <Card title="Medicamentos mais prescritos" extra={<span className="font-normal normal-case text-zinc-400">· clique p/ resumo</span>}>
                <Bars
                  items={data.medicamentos}
                  colors={() => "bg-brand-navy"}
                  onPick={(i) => {
                    const med = data.medicamentosDetalhe.find((m) => m.name.toLowerCase() === i.name.toLowerCase());
                    if (med) setPopup({ tipo: "med", med, voltar: false });
                  }}
                />
              </Card>
            </div>
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
          {popup?.tipo === "resumo" && <ResumoPopup data={data} onClose={() => setPopup(null)} onPick={(med) => setPopup({ tipo: "med", med, voltar: true })} />}
          {popup?.tipo === "med" && <MedPopup med={popup.med} cmedRef={data.resumoMeds.cmedRef} onClose={() => setPopup(popup.voltar ? { tipo: "resumo" } : null)} />}
        </>
      )}
    </div>
  );
}
