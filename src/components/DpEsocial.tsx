"use client";

import { useCallback, useEffect, useState } from "react";
import type { DpEmployee } from "@/lib/dp";

/* eSocial no Departamento Pessoal — SOMENTE ambiente de testes (produção restrita). */

interface Ocorrencia { tipo: string | null; codigo: string | null; descricao: string | null; localizacao: string | null }
interface Resumo {
  cdResposta: string | null;
  descResposta: string | null;
  fault?: string | null;
  eventos: { id: string; cdResposta: string | null; descResposta: string | null; recibo: string | null; ocorrencias: Ocorrencia[] }[];
}
interface Evento {
  id: string;
  tipo: string;
  status: string;
  event_id: string;
  protocolo: string | null;
  resposta: { httpStatus?: number; resumo?: Resumo } | null;
  created_at: string;
  sent_at: string | null;
}

const STATUS_LABEL: Record<string, { t: string; c: string }> = {
  assinado: { t: "Assinado · não enviado", c: "bg-zinc-100 text-zinc-700" },
  enviado: { t: "Enviado · aguardando processamento", c: "bg-amber-100 text-amber-800" },
  processado: { t: "Processado", c: "bg-emerald-100 text-emerald-800" },
  rejeitado: { t: "Rejeitado", c: "bg-red-100 text-red-700" },
  erro: { t: "Erro no envio", c: "bg-red-100 text-red-700" },
};
const TIPO_LABEL: Record<string, string> = {
  "S-1000": "S-1000 · Empregador",
  "S-1005": "S-1005 · Estabelecimento",
  "S-2200": "S-2200 · Admissão",
  "S-2206": "S-2206 · Alteração contratual",
  "S-2230": "S-2230 · Afastamento / férias",
  "S-2299": "S-2299 · Desligamento",
};
const fmtDT = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");
const btn = "rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-[#06231f] hover:bg-teal-400 disabled:opacity-50";
const btn2 = "rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-50 disabled:opacity-50";

function TestBanner() {
  return (
    <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
      <b>Ambiente de TESTES do eSocial (produção restrita).</b> O que for enviado aqui não tem valor legal. O envio real só será liberado depois, com a sua confirmação.
    </p>
  );
}

/** Lista de eventos com ver XML, enviar e consultar resultado. */
function Eventos({ query, refresh, onChanged }: { query: string; refresh: number; onChanged: () => void }) {
  const [items, setItems] = useState<Evento[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [xml, setXml] = useState<{ id: string; text: string } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/admin/dp/esocial/events?${query}`);
    const d = await r.json().catch(() => ({}));
    if (r.ok) setItems(d.eventos ?? []);
  }, [query]);
  useEffect(() => {
    load();
  }, [load, refresh]);

  async function act(ev: Evento, action: "enviar" | "consultar") {
    if (action === "enviar" && !confirm(`Enviar ${TIPO_LABEL[ev.tipo] ?? ev.tipo} ao eSocial (AMBIENTE DE TESTES)?\n\nID do evento: ${ev.event_id}`)) return;
    setBusy(ev.id);
    setMsg(null);
    try {
      const r = await fetch(`/api/admin/dp/esocial/events/${ev.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, confirm: true }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) setMsg(d.error ?? "Falha na operação");
      else if (d.resumo?.fault) setMsg(`eSocial: ${d.resumo.fault}`);
      await load();
      onChanged();
    } finally {
      setBusy(null);
    }
  }

  async function verXml(ev: Evento) {
    if (xml?.id === ev.id) return setXml(null);
    const r = await fetch(`/api/admin/dp/esocial/events/${ev.id}`);
    const d = await r.json().catch(() => ({}));
    if (r.ok) setXml({ id: ev.id, text: d.evento.xml });
  }

  if (items.length === 0) return <p className="text-sm text-zinc-500">Nenhum evento gerado ainda.</p>;
  return (
    <div className="space-y-3">
      {msg && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{msg}</p>}
      {items.map((ev) => {
        const st = STATUS_LABEL[ev.status] ?? { t: ev.status, c: "bg-zinc-100" };
        const res = ev.resposta?.resumo;
        const meu = res?.eventos?.[0];
        const ocs = meu?.ocorrencias ?? [];
        return (
          <div key={ev.id} className="rounded-lg border border-zinc-200 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{TIPO_LABEL[ev.tipo] ?? ev.tipo}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.c}`}>{st.t}</span>
              <span className="ml-auto text-xs text-zinc-400">{fmtDT(ev.created_at)}</span>
            </div>
            <p className="mt-1 break-all text-[11px] text-zinc-400">
              {ev.event_id}
              {ev.protocolo ? ` · protocolo ${ev.protocolo}` : ""}
              {meu?.recibo ? ` · recibo ${meu.recibo}` : ""}
            </p>
            {res && (res.descResposta || meu?.descResposta) && (
              <p className="mt-1 text-xs text-zinc-600">
                eSocial: {meu?.cdResposta ?? res.cdResposta} — {meu?.descResposta ?? res.descResposta}
              </p>
            )}
            {ocs.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-xs text-red-700">
                {ocs.map((o, i) => (
                  <li key={i}>
                    {o.codigo}: {o.descricao}
                    {o.localizacao ? ` (${o.localizacao})` : ""}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={btn2} onClick={() => verXml(ev)}>{xml?.id === ev.id ? "Ocultar XML" : "Ver XML assinado"}</button>
              {(ev.status === "assinado" || ev.status === "erro") && (
                <button className={btn2} disabled={busy === ev.id} onClick={() => act(ev, "enviar")}>{busy === ev.id ? "Enviando…" : "Enviar ao eSocial (teste)"}</button>
              )}
              {ev.protocolo && (
                <button className={btn2} disabled={busy === ev.id} onClick={() => act(ev, "consultar")}>{busy === ev.id ? "Consultando…" : "Consultar resultado"}</button>
              )}
            </div>
            {xml?.id === ev.id && <pre className="mt-2 max-h-64 overflow-auto rounded bg-zinc-50 p-2 text-[10px] leading-snug">{xml.text}</pre>}
          </div>
        );
      })}
    </div>
  );
}

async function gerar(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; missing?: string[] }> {
  const r = await fetch("/api/admin/dp/esocial/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  return r.ok ? { ok: true } : { ok: false, error: d.error ?? "Falha ao gerar o evento", missing: d.missing };
}

function Faltam({ error, missing }: { error: string | null; missing: string[] | null }) {
  if (!error) return null;
  return (
    <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
      <p>{error}</p>
      {missing && missing.length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-xs">
          {missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------ Empresa (S-1000) ------------------------------ */

interface Status {
  ok?: boolean;
  error?: string;
  httpStatus?: number;
  certificate?: { subject: string; validTo: string; daysToExpire: number | null };
  config?: Record<string, string | null>;
}

export function EsocialEmpresa() {
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(false);
  const [emp, setEmp] = useState<Record<string, string>>({});
  const [info, setInfo] = useState<{ ambiente: string | null; cnpj: string | null }>({ ambiente: null, cnpj: null });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [miss, setMiss] = useState<string[] | null>(null);
  const [operacao, setOperacao] = useState("inclusao");
  const [refresh, setRefresh] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const r = await fetch("/api/admin/dp/esocial/status");
      setStatus(await r.json().catch(() => ({ ok: false, error: "Sem resposta" })));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
    fetch("/api/admin/dp/esocial/empresa")
      .then((r) => r.json())
      .then((d) => {
        if (d.empresa) setEmp(d.empresa);
        setInfo({ ambiente: d.ambiente ?? null, cnpj: d.cnpj ?? null });
      })
      .catch(() => {});
  }, [check]);

  const set = (k: string, v: string) => setEmp((e) => ({ ...e, [k]: v }));
  const inp = (k: string, label: string, ph = "") => (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-zinc-600">{label}</span>
      <input value={emp[k] ?? ""} placeholder={ph} onChange={(e) => set(k, e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
    </label>
  );

  async function save() {
    if (!confirm("Confirma salvar os dados do empregador para o eSocial?")) return;
    setSaving(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/dp/esocial/empresa", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(emp) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setErr(d.error ?? "Não foi possível salvar");
      setMsg("Dados salvos.");
    } finally {
      setSaving(false);
    }
  }

  async function gerarS1000() {
    if (!confirm(`Gerar e assinar o S-1000 (${operacao === "alteracao" ? "alteração" : "inclusão"})? Nada será enviado ainda.`)) return;
    setErr(null);
    setMiss(null);
    const r = await gerar({ tipo: "S-1000", operacao });
    if (!r.ok) {
      setErr(r.error ?? "Falha");
      setMiss(r.missing ?? null);
    } else setRefresh((n) => n + 1);
  }

  async function gerarS1005() {
    if (!confirm(`Gerar e assinar o S-1005 (${operacao === "alteracao" ? "alteração" : "inclusão"})? Nada será enviado ainda.`)) return;
    setErr(null);
    setMiss(null);
    const r = await gerar({ tipo: "S-1005", operacao });
    if (!r.ok) {
      setErr(r.error ?? "Falha");
      setMiss(r.missing ?? null);
    } else setRefresh((n) => n + 1);
  }

  const cert = status?.certificate;
  const venc = cert?.daysToExpire ?? null;
  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-[#0b1f3a]">eSocial · Empresa</h1>
        <p className="text-xs text-zinc-500">Conexão com o eSocial, dados do empregador (S-1000) e histórico de envios</p>
      </div>
      <TestBanner />

      <div className="mb-5 rounded-xl border border-zinc-200 bg-white p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#0b1f3a]">Conexão e certificado digital</h2>
          <button className={btn2} onClick={check} disabled={checking}>{checking ? "Verificando…" : "Verificar de novo"}</button>
        </div>
        {!status ? (
          <p className="text-sm text-zinc-400">Verificando…</p>
        ) : status.ok ? (
          <div className="text-sm">
            <p className="text-emerald-700">✓ Conectado ao eSocial (testes) · HTTP {status.httpStatus}</p>
            {cert && (
              <p className="mt-1 text-zinc-600">
                {cert.subject} · vence em {new Date(cert.validTo).toLocaleDateString("pt-BR")}{" "}
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${venc !== null && venc <= 30 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"}`}>
                  {venc !== null ? `${venc} dias` : "—"}
                </span>
              </p>
            )}
            {venc !== null && venc <= 30 && <p className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">Atenção: o certificado vence em {venc} dias. Providencie a renovação.</p>}
          </div>
        ) : (
          <p className="text-sm text-red-700">Sem conexão: {status.error ?? "erro desconhecido"}</p>
        )}
        <p className="mt-2 text-[11px] text-zinc-400">Ambiente: {info.ambiente === "2" ? "produção restrita (testes)" : info.ambiente ?? "não configurado"} · CNPJ {info.cnpj ?? "—"}</p>
      </div>

      <div className="mb-5 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#0b1f3a]">Dados do empregador (S-1000)</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {inp("classTrib", "Classificação tributária (Tabela 08)", "01 = Simples Nacional")}
          {inp("indPorte", "Porte (S = ME/EPP; vazio = não informar)", "S")}
          {inp("indDesFolha", "Desoneração da folha", "0")}
          {inp("indOptRegEletron", "Registro eletrônico de empregados", "0")}
          {inp("iniValid", "Início da validade (AAAA-MM)", "2026-01")}
          {inp("cnpjSind", "CNPJ do sindicato da categoria (14 dígitos)")}
          {inp("cnaePrep", "CNAE preponderante (7 dígitos) — S-1005", "ex.: 8630504")}
          {inp("aliqRat", "Alíquota RAT (1, 2 ou 3) — só se não for Simples", "")}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button className={btn} onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar dados"}</button>
          {msg && <span className="text-xs text-emerald-700">{msg}</span>}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#0b1f3a]">S-1000 e histórico</h2>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <select value={operacao} onChange={(e) => setOperacao(e.target.value)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
            <option value="inclusao">Inclusão (primeiro envio)</option>
            <option value="alteracao">Alteração (já existe no eSocial)</option>
          </select>
          <button className={btn} onClick={gerarS1000}>Gerar e assinar S-1000</button>
        </div>
        <Faltam error={err} missing={miss} />
        <div className="mt-4">
          <Eventos query="tipo=S-1000" refresh={refresh} onChanged={() => setRefresh((n) => n + 1)} />
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-[#0b1f3a]">S-1005 · Estabelecimento</h2>
        <p className="mb-3 text-xs text-zinc-500">Obrigatório antes da admissão (S-2200): cadastra o estabelecimento onde o colaborador trabalha. Usa o CNAE informado acima.</p>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <button className={btn} onClick={gerarS1005}>Gerar e assinar S-1005</button>
        </div>
        <Eventos query="tipo=S-1005" refresh={refresh} onChanged={() => setRefresh((n) => n + 1)} />
      </div>
    </>
  );
}

/* --------------------------- Aba eSocial da ficha --------------------------- */

const ESOCIAL_FIELDS: { k: string; label: string; ph?: string }[] = [
  { k: "matricula", label: "Matrícula (vazio = automática)" },
  { k: "cbo", label: "CBO do cargo (6 dígitos)", ph: "422105" },
  { k: "sexo", label: "Sexo (M ou F)" },
  { k: "racaCor", label: "Raça/cor (1 branca, 2 preta, 3 parda, 4 amarela, 5 indígena, 6 não informada)" },
  { k: "estCiv", label: "Estado civil (1 solteiro, 2 casado, 3 divorciado, 4 separado, 5 viúvo)" },
  { k: "grauInstr", label: "Grau de instrução (01 a 12; 09 = superior completo)" },
  { k: "dtNascto", label: "Data de nascimento (DD/MM/AAAA)" },
  { k: "dscLograd", label: "Logradouro" },
  { k: "nrLograd", label: "Número" },
  { k: "complemento", label: "Complemento" },
  { k: "bairro", label: "Bairro" },
  { k: "cep", label: "CEP" },
  { k: "codMunic", label: "Código do município (IBGE, 7 dígitos)", ph: "3304557" },
  { k: "uf", label: "UF" },
  { k: "fonePrinc", label: "Telefone" },
  { k: "emailPrinc", label: "E-mail" },
  { k: "cnpjSind", label: "CNPJ do sindicato (vazio = o da empresa)" },
  { k: "dtOpcFGTS", label: "Data de opção do FGTS (vazio = admissão)" },
  { k: "qtdHrsSem", label: "Horas semanais", ph: "44" },
  { k: "dscJorn", label: "Descrição da jornada (para jornada tipo 9)" },
];

export function EsocialFichaTab({ emp, onChanged }: { emp: DpEmployee; onChanged: () => Promise<void> }) {
  const [form, setForm] = useState<Record<string, string>>({ ...(emp.esocial ?? {}) });
  const [saving, setSaving] = useState(false);
  const [tipo, setTipo] = useState("S-2200");
  const [p, setP] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [miss, setMiss] = useState<string[] | null>(null);
  const [refresh, setRefresh] = useState(0);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const sp = (k: string, v: string) => setP((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!confirm("Confirma salvar os dados para o eSocial deste colaborador?")) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/dp/employees/${emp.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ esocial: form }) });
      if (!r.ok) return alert("Não foi possível salvar.");
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function criar() {
    setErr(null);
    setMiss(null);
    if (!confirm(`Gerar e assinar ${TIPO_LABEL[tipo]} para ${emp.full_name}? Nada será enviado ainda.`)) return;
    const params = { ...p };
    const r = await gerar({ tipo, employee_id: emp.id, params });
    if (!r.ok) {
      setErr(r.error ?? "Falha");
      setMiss(r.missing ?? null);
    } else setRefresh((n) => n + 1);
  }

  const pin = (k: string, label: string, type = "text") => (
    <label className="block text-xs">
      <span className="mb-1 block font-medium text-zinc-600">{label}</span>
      <input type={type} value={p[k] ?? ""} onChange={(e) => sp(k, e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
    </label>
  );

  return (
    <div className="space-y-4">
      <TestBanner />
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold text-[#0b1f3a]">Dados para o eSocial</h2>
        <p className="mb-3 text-xs text-zinc-500">CPF, nome, cargo, salário e data de admissão vêm da aba “Dados e vencimentos”. Aqui ficam os campos extras que o eSocial exige.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ESOCIAL_FIELDS.map((f) => (
            <label key={f.k} className="block text-xs">
              <span className="mb-1 block font-medium text-zinc-600">{f.label}</span>
              <input value={form[f.k] ?? ""} placeholder={f.ph} onChange={(e) => set(f.k, e.target.value)} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
            </label>
          ))}
        </div>
        <button className={`${btn} mt-4`} onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar dados do eSocial"}</button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#0b1f3a]">Gerar evento</h2>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-zinc-600">Evento</span>
            <select value={tipo} onChange={(e) => { setTipo(e.target.value); setP({}); setErr(null); setMiss(null); }} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
              {["S-2200", "S-2206", "S-2230", "S-2299"].map((t) => (
                <option key={t} value={t}>{TIPO_LABEL[t]}</option>
              ))}
            </select>
          </label>
          {tipo === "S-2206" && (<>{pin("dtAlteracao", "Data da alteração", "date")}{pin("dscAlt", "Descrição (opcional)")}</>)}
          {tipo === "S-2230" && (
            <>
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-zinc-600">Momento</span>
                <select value={p.modo ?? "inicio"} onChange={(e) => sp("modo", e.target.value)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
                  <option value="inicio">Início do afastamento</option>
                  <option value="fim">Término do afastamento</option>
                </select>
              </label>
              {(p.modo ?? "inicio") === "inicio" ? (
                <>
                  {pin("dtIniAfast", "Data de início", "date")}
                  {pin("codMotAfast", "Motivo (Tabela 18; 15 = férias)")}
                  {p.codMotAfast === "15" && (<>{pin("perAquisInicio", "Início do período aquisitivo", "date")}{pin("perAquisFim", "Fim do período aquisitivo (opcional)", "date")}</>)}
                  {p.codMotAfast === "21" && pin("observacao", "Observação")}
                </>
              ) : (
                pin("dtTermAfast", "Data de término", "date")
              )}
            </>
          )}
          {tipo === "S-2299" && (
            <>
              {pin("mtvDeslig", "Motivo do desligamento (Tabela 19)")}
              {pin("dtDeslig", "Último dia trabalhado", "date")}
              <label className="block text-xs">
                <span className="mb-1 block font-medium text-zinc-600">Aviso prévio indenizado?</span>
                <select value={p.indPagtoAPI ?? "N"} onChange={(e) => sp("indPagtoAPI", e.target.value)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
                  <option value="N">Não</option>
                  <option value="S">Sim</option>
                </select>
              </label>
              {p.indPagtoAPI === "S" && pin("dtProjFimAPI", "Data projetada do fim do aviso", "date")}
            </>
          )}
          <button className={btn} onClick={criar}>Gerar e assinar</button>
        </div>
        <Faltam error={err} missing={miss} />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#0b1f3a]">Histórico de eventos</h2>
        <Eventos query={`employee_id=${emp.id}`} refresh={refresh} onChanged={() => setRefresh((n) => n + 1)} />
      </div>
    </div>
  );
}
