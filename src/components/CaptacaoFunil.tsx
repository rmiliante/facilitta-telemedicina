"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { APPLICATION_STATUSES, SHIFTS, type ApplicationStatus } from "@/lib/doctorApplications";

/**
 * Captação de profissionais: funil do candidato até o primeiro atendimento,
 * origem (site/orgânico x formulário/pago), filtros, ficha com modelos de
 * e-mail e importação do CSV do site.
 */

interface LinkedDoctor {
  id: string;
  complete: boolean;
  signing: boolean;
  attended: boolean;
}

interface Application {
  id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  crm: string | null;
  crm_uf: string | null;
  specialty: string | null;
  specializations?: string[] | null;
  profession?: string | null;
  collaboration?: string | null;
  comments?: string | null;
  innovative_idea?: string | null;
  origin?: string | null;
  received_at?: string | null;
  experience_years: number | null;
  consult_price: number | null;
  available_days: string[] | null;
  available_shifts: string[] | null;
  presentation: string | null;
  photo_url: string | null;
  status: ApplicationStatus;
  reviewed_at?: string | null;
  created_at: string;
  doctor: LinkedDoctor | null;
}

type Stage = "novo" | "em_avaliacao" | "falta_cadastro" | "incompleto" | "assinatura" | "atendendo" | "recusado";

const STAGES: { key: Stage; label: string; hint: string; tone: string }[] = [
  { key: "novo", label: "Novos", hint: "sem análise", tone: "text-sky-700" },
  { key: "em_avaliacao", label: "Em avaliação", hint: "em contato", tone: "text-amber-700" },
  { key: "falta_cadastro", label: "Aprovados", hint: "falta cadastro", tone: "text-emerald-700" },
  { key: "incompleto", label: "Cadastro incompleto", hint: "falta CPF/CRM", tone: "text-orange-700" },
  { key: "assinatura", label: "Assinatura pendente", hint: "falta certificado", tone: "text-violet-700" },
  { key: "atendendo", label: "Atendendo", hint: "ativo", tone: "text-brand-teal-dark" },
];

const STAGE_LABEL: Record<Stage, string> = {
  novo: "Novo",
  em_avaliacao: "Em avaliação",
  falta_cadastro: "Aprovado · falta cadastro",
  incompleto: "Cadastro incompleto",
  assinatura: "Assinatura pendente",
  atendendo: "Atendendo",
  recusado: "Recusado",
};

const STAGE_STYLE: Record<Stage, string> = {
  novo: "bg-sky-50 text-sky-700",
  em_avaliacao: "bg-amber-50 text-amber-700",
  falta_cadastro: "bg-emerald-50 text-emerald-700",
  incompleto: "bg-orange-50 text-orange-700",
  assinatura: "bg-violet-50 text-violet-700",
  atendendo: "bg-teal-50 text-brand-teal-dark",
  recusado: "bg-red-50 text-red-700",
};

const STATUS_LABEL: Record<ApplicationStatus, string> = {
  novo: "Novo",
  em_avaliacao: "Em avaliação",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

const DAY = 24 * 60 * 60 * 1000;

function stageOf(a: Application): Stage {
  if (a.status === "recusado") return "recusado";
  if (a.status === "novo") return "novo";
  if (a.status === "em_avaliacao") return "em_avaliacao";
  if (!a.doctor) return "falta_cadastro";
  if (!a.doctor.complete) return "incompleto";
  if (a.doctor.attended || a.doctor.signing) return "atendendo";
  return "assinatura";
}

function profession(a: Application) {
  return a.profession?.trim() || "Médico(a)";
}

function initials(name: string) {
  return name
    .replace(/^Dra?\.\s*/i, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function registry(a: Application) {
  if (!a.crm) return "—";
  return `${a.crm}${a.crm_uf ? `-${a.crm_uf}` : ""}`;
}

// ------------------------------------------------------------
// Modelos de e-mail: abrem o e-mail do usuário já preenchido (nada é enviado sozinho).
// ------------------------------------------------------------
const TEMPLATES: { key: string; label: string; subject: string; body: (name: string) => string }[] = [
  {
    key: "convite",
    label: "Convite / próximos passos",
    subject: "Facilitta Saúde — próximos passos do seu cadastro",
    body: (n) =>
      `Olá, ${n}!\n\nObrigado pelo interesse em fazer parte da Facilitta Saúde. Gostaríamos de seguir com o seu cadastro na plataforma de telemedicina.\n\nPodemos agendar uma conversa rápida para apresentar o modelo de atendimento? Responda este e-mail com os melhores dias e horários.\n\nAtenciosamente,\nEquipe Facilitta Saúde`,
  },
  {
    key: "documentos",
    label: "Pedido de documentos",
    subject: "Facilitta Saúde — documentos para o cadastro",
    body: (n) =>
      `Olá, ${n}!\n\nPara concluir o seu cadastro, precisamos dos seguintes dados:\n\n- Nome completo e CPF\n- Número e UF do registro profissional (CRM ou conselho)\n- Especialidade e número de RQE, se houver\n- Endereço profissional (para constar nas receitas)\n- Certificado digital que você utiliza (VIDaaS ou BirdID)\n\nAssim que recebermos, liberamos o seu acesso.\n\nAtenciosamente,\nEquipe Facilitta Saúde`,
  },
  {
    key: "espera",
    label: "Agradecimento / lista de espera",
    subject: "Facilitta Saúde — recebemos o seu cadastro",
    body: (n) =>
      `Olá, ${n}!\n\nRecebemos o seu cadastro profissional e agradecemos o interesse. No momento estamos avaliando a necessidade da sua área e entraremos em contato assim que houver uma oportunidade.\n\nAtenciosamente,\nEquipe Facilitta Saúde`,
  },
  {
    key: "recusa",
    label: "Recusa cordial",
    subject: "Facilitta Saúde — retorno sobre o seu cadastro",
    body: (n) =>
      `Olá, ${n}!\n\nAgradecemos o interesse em fazer parte da Facilitta Saúde. Neste momento não seguiremos com o seu cadastro, mas manteremos o seu contato para futuras oportunidades.\n\nAtenciosamente,\nEquipe Facilitta Saúde`,
  },
];

function mailto(a: Application, t: (typeof TEMPLATES)[number]) {
  const first = a.name.replace(/^Dra?\.\s*/i, "").split(" ")[0] || a.name;
  const greeting = /^dra\./i.test(a.name) ? `Dra. ${first}` : /^dr\./i.test(a.name) ? `Dr. ${first}` : first;
  return `mailto:${encodeURIComponent(a.email)}?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(t.body(greeting))}`;
}

// ------------------------------------------------------------
// CSV do site
// ------------------------------------------------------------
function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const first = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const FIELD_ALIASES: Record<string, string[]> = {
  name: ["nome", "nome completo", "name"],
  email: ["email", "e mail", "mail"],
  phone: ["telefone", "whatsapp", "celular", "phone", "fone"],
  city: ["cidade", "city"],
  state: ["estado", "uf", "state"],
  profession: ["tipo de profissional", "tipo profissional", "profissao", "tipo"],
  registry: ["registro profissional", "registro", "crm", "conselho"],
  specialty: ["especialidade", "area de atuacao", "area"],
  collaboration: ["como gostaria de colaborar", "colaboracao", "como deseja colaborar"],
  comments: ["comentarios", "comentario", "observacoes", "mensagem"],
  idea: ["ideia inovadora", "ideia"],
  receivedAt: ["enviado em", "data", "data de envio", "recebido em", "received at", "created at"],
};

function csvToRows(text: string) {
  const table = parseCsv(text);
  if (table.length < 2) return [];
  const header = table[0].map(norm);
  const idx: Record<string, number> = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const i = header.findIndex((h) => aliases.includes(h));
    if (i >= 0) idx[field] = i;
  }
  return table.slice(1).map((r) => {
    const out: Record<string, string> = {};
    for (const [field, i] of Object.entries(idx)) out[field] = (r[i] ?? "").trim();
    return out;
  });
}

// ------------------------------------------------------------

export default function CaptacaoFunil() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const [selected, setSelected] = useState<Application | null>(null);
  const [editing, setEditing] = useState<Application | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);

  const [search, setSearch] = useState("");
  const [fProfession, setFProfession] = useState("");
  const [fOrigin, setFOrigin] = useState("");
  const [fCollab, setFCollab] = useState("");
  const [fSpecialty, setFSpecialty] = useState("");
  const [fSpecs, setFSpecs] = useState<string[]>([]);
  const [fCity, setFCity] = useState("");
  const [fStage, setFStage] = useState<"" | Stage>("");

  const [importRows, setImportRows] = useState<Record<string, string>[] | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showChecklist, setShowChecklist] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNow(Date.now());
    try {
      const res = await fetch("/api/admin/doctor-applications");
      if (res.ok) setApps((await res.json()).applications);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, [load]);

  const originOf = (a: Application) => (a.origin === "organico" ? "organico" : "pago");
  const waitingDays = useCallback(
    (a: Application): number | null => {
      if (!now) return null;
      if (a.status === "novo") return Math.floor((now - new Date(a.received_at ?? a.created_at).getTime()) / DAY);
      if (a.status === "em_avaliacao" && a.reviewed_at) return Math.floor((now - new Date(a.reviewed_at).getTime()) / DAY);
      return null;
    },
    [now]
  );

  const opts = useMemo(() => {
    const uniq = (xs: (string | null | undefined)[]) =>
      Array.from(new Set(xs.map((x) => x?.trim()).filter((x): x is string => !!x))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    return {
      professions: uniq(apps.map(profession)),
      collabs: uniq(apps.map((a) => a.collaboration)),
      specialties: uniq(apps.map((a) => a.specialty)),
      specs: uniq(apps.filter((a) => !fSpecialty || a.specialty === fSpecialty).flatMap((a) => a.specializations ?? [])),
      cities: uniq(apps.map((a) => a.city)),
    };
  }, [apps, fSpecialty]);

  const counts = useMemo(() => {
    const c: Record<Stage, number> = { novo: 0, em_avaliacao: 0, falta_cadastro: 0, incompleto: 0, assinatura: 0, atendendo: 0, recusado: 0 };
    for (const a of apps) c[stageOf(a)] += 1;
    return c;
  }, [apps]);

  const filtered = apps.filter((a) => {
    if (search) {
      const q = search.toLowerCase();
      const hay = [a.name, a.email, a.crm ?? "", a.specialty ?? "", ...(a.specializations ?? [])];
      if (!hay.some((v) => v.toLowerCase().includes(q))) return false;
    }
    if (fProfession && profession(a) !== fProfession) return false;
    if (fOrigin && originOf(a) !== fOrigin) return false;
    if (fCollab && a.collaboration !== fCollab) return false;
    if (fSpecialty && a.specialty !== fSpecialty) return false;
    if (fSpecs.length > 0 && !fSpecs.some((s) => (a.specializations ?? []).includes(s))) return false;
    if (fCity && a.city !== fCity) return false;
    if (fStage && stageOf(a) !== fStage) return false;
    return true;
  });

  const semResposta = apps.filter((a) => (waitingDays(a) ?? 0) >= 7).length;

  function askStatus(app: Application, next: ApplicationStatus) {
    setPending({
      title: `Marcar como ${STATUS_LABEL[next]}?`,
      body: `O candidato ${app.name} passará de "${STATUS_LABEL[app.status]}" para "${STATUS_LABEL[next]}".`,
      label: "Confirmar",
      run: () => setStatus(app, next),
    });
  }

  function askDelete(app: Application) {
    setPending({
      title: "Excluir candidato?",
      body: `Você vai excluir ${app.name} (${registry(app)}). Essa ação não pode ser desfeita.`,
      label: "Sim, excluir",
      danger: true,
      run: async () => {
        const res = await fetch(`/api/admin/doctor-applications/${app.id}`, { method: "DELETE" });
        if (!res.ok) {
          alert("Não foi possível excluir. Tente novamente.");
          return;
        }
        setSelected(null);
        await load();
      },
    });
  }

  async function setStatus(app: Application, next: ApplicationStatus) {
    const res = await fetch(`/api/admin/doctor-applications/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Falha ao atualizar candidatura");
      return;
    }
    setSelected(null);
    await load();
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setImportMsg(null);
    const rows = csvToRows(await file.text());
    if (rows.length === 0 || !rows.some((r) => r.email)) {
      setImportRows(null);
      setImportMsg("Não encontrei candidatos nesse arquivo. Confira se a primeira linha tem os nomes das colunas (Nome, E-mail, ...).");
      return;
    }
    setImportRows(rows);
  }

  async function confirmImport() {
    if (!importRows) return;
    setImporting(true);
    try {
      const res = await fetch("/api/admin/doctor-applications/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: importRows }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportMsg(data.error ?? "Falha ao importar");
        return;
      }
      setImportMsg(
        `${data.imported} candidato(s) importado(s). ${data.alreadyThere} já estavam na lista e ${data.duplicatesInFile} eram reenvios repetidos (ignorados).`
      );
      setImportRows(null);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } finally {
      setImporting(false);
    }
  }

  const importPreview = useMemo(() => {
    if (!importRows) return null;
    const emails = new Set(importRows.map((r) => (r.email ?? "").toLowerCase()).filter(Boolean));
    return { lines: importRows.length, unique: emails.size };
  }, [importRows]);

  const input = "rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand-teal-dark";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          {apps.length} candidatos · {semResposta} sem resposta há 7+ dias
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
          <button
            type="button"
            onClick={() => setShowChecklist((v) => !v)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Checklist de ativação
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white"
          >
            Importar CSV do site
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </div>

      {importPreview && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-teal-dark/30 bg-teal-50 p-4 text-xs text-zinc-700">
          <span>
            Arquivo com <b>{importPreview.lines}</b> linhas · <b>{importPreview.unique}</b> e-mails diferentes. Os repetidos viram um só candidato
            (origem: orgânico) e quem já está na lista é ignorado.
          </span>
          <span className="flex gap-2">
            <button type="button" disabled={importing} onClick={confirmImport} className="rounded-md bg-brand-navy px-3 py-1.5 font-medium text-white disabled:opacity-60">
              {importing ? "Importando..." : "Importar agora"}
            </button>
            <button type="button" onClick={() => setImportRows(null)} className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 font-medium text-zinc-600">
              Cancelar
            </button>
          </span>
        </div>
      )}
      {importMsg && <p className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-700">{importMsg}</p>}

      {showChecklist && (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-xs text-zinc-700">
          <p className="mb-2 font-semibold text-zinc-900">Para o médico começar a atender</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Aprovar a candidatura.</li>
            <li>Criar o cadastro do médico (botão na ficha) e repassar o acesso provisório.</li>
            <li>Completar CPF, CRM/UF e endereço profissional na tela de Médicos.</li>
            <li>O médico escolhe o certificado (VIDaaS ou BirdID) e aprova no aplicativo.</li>
            <li>Conferir o primeiro atendimento.</li>
          </ol>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {STAGES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setFStage(fStage === s.key ? "" : s.key)}
            className={`rounded-lg border bg-white p-3 text-left transition-colors hover:bg-zinc-50 ${fStage === s.key ? "border-brand-teal-dark" : "border-zinc-200"}`}
          >
            <p className="text-[11px] font-medium text-zinc-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${s.tone}`}>{counts[s.key]}</p>
            <p className="text-[10px] text-zinc-400">{s.hint}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nome, e-mail, registro ou especialidade" className={`w-64 ${input}`} />
        <select value={fProfession} onChange={(e) => setFProfession(e.target.value)} className={input} aria-label="Profissão">
          <option value="">Profissão: todas</option>
          {opts.professions.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select value={fOrigin} onChange={(e) => setFOrigin(e.target.value)} className={input} aria-label="Origem">
          <option value="">Origem: todas</option>
          <option value="organico">Site (orgânico)</option>
          <option value="pago">Formulário (pago)</option>
        </select>
        <select value={fCollab} onChange={(e) => setFCollab(e.target.value)} className={input} aria-label="Colaboração">
          <option value="">Colaboração: todas</option>
          {opts.collabs.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select
          value={fSpecialty}
          onChange={(e) => {
            setFSpecialty(e.target.value);
            setFSpecs([]);
          }}
          className={input}
          aria-label="Especialidade"
        >
          <option value="">Especialidade: todas</option>
          {opts.specialties.map((v) => (
            <option key={v} value={v}>
              {v} ({apps.filter((a) => a.specialty === v).length})
            </option>
          ))}
        </select>
        {fSpecialty && opts.specs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-teal-200 bg-teal-50/50 px-2 py-1" aria-label="Especializações">
            <span className="text-xs font-medium text-teal-800">{fSpecialty} ›</span>
            {opts.specs.map((s) => {
              const on = fSpecs.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFSpecs(on ? fSpecs.filter((x) => x !== s) : [...fSpecs, s])}
                  className={`rounded-full border px-2 py-0.5 text-xs ${on ? "border-teal-700 bg-teal-700 text-white" : "border-teal-200 bg-white text-teal-800 hover:bg-teal-50"}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        )}
        <select value={fCity} onChange={(e) => setFCity(e.target.value)} className={input} aria-label="Cidade">
          <option value="">Cidade: todas</option>
          {opts.cities.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <select value={fStage} onChange={(e) => setFStage(e.target.value as "" | Stage)} className={input} aria-label="Etapa">
          <option value="">Etapa: todas</option>
          {(Object.keys(STAGE_LABEL) as Stage[]).map((k) => (
            <option key={k} value={k}>
              {STAGE_LABEL[k]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setFProfession("");
            setFOrigin("");
            setFCollab("");
            setFSpecialty("");
            setFSpecs([]);
            setFCity("");
            setFStage("");
          }}
          className="text-xs font-medium text-brand-teal-dark hover:underline"
        >
          Limpar filtros
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full whitespace-nowrap text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              <th className="px-3 py-2.5">Candidato</th>
              <th className="px-3 py-2.5">Profissão</th>
              <th className="px-3 py-2.5">Especialidade</th>
              <th className="px-3 py-2.5">Cidade</th>
              <th className="px-3 py-2.5">Colaboração</th>
              <th className="px-3 py-2.5">Origem</th>
              <th className="px-3 py-2.5">Etapa</th>
              <th className="px-3 py-2.5">Sem resposta</th>
              <th className="sticky right-0 border-l border-zinc-100 bg-white px-3 py-2.5">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const days = waitingDays(a);
              return (
                <tr key={a.id} className="border-b border-zinc-100 last:border-0">
                  <td className="px-3 py-2.5">
                    <button type="button" onClick={() => setSelected(a)} className="flex items-center gap-2.5 text-left">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-500">{initials(a.name)}</span>
                      <span>
                        <span className="block font-medium text-zinc-800">{a.name}</span>
                        <span className="block text-xs text-zinc-400">{registry(a)}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-600">{profession(a)}</td>
                  <td className="px-3 py-2.5 text-zinc-600">
                    {a.specialty || "—"}
                    {(a.specializations ?? []).length > 0 && <span className="block text-xs text-zinc-400">› {(a.specializations ?? []).join(", ")}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-zinc-600">{a.city ? `${a.city}${a.state ? ` - ${a.state}` : ""}` : a.state || "—"}</td>
                  <td className="max-w-[130px] truncate px-3 py-2.5 text-zinc-600" title={a.collaboration ?? ""}>
                    {a.collaboration || "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${originOf(a) === "organico" ? "bg-teal-50 text-brand-teal-dark" : "bg-indigo-50 text-indigo-700"}`}
                    >
                      {originOf(a) === "organico" ? "SITE" : "PAGO"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_STYLE[stageOf(a)]}`}>{STAGE_LABEL[stageOf(a)]}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {days === null ? (
                      <span className="text-zinc-300">—</span>
                    ) : (
                      <span className={days >= 7 ? "font-semibold text-amber-700" : "text-zinc-500"}>{days} d</span>
                    )}
                  </td>
                  <td className="sticky right-0 border-l border-zinc-100 bg-white px-3 py-2.5">
                    <div className="flex gap-1.5">
                      <button onClick={() => setSelected(a)} className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50">
                        Abrir
                      </button>
                      <button onClick={() => setEditing(a)} className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50">
                        Editar
                      </button>
                      {a.status !== "aprovado" && a.status !== "recusado" && (
                        <button onClick={() => askStatus(a, "aprovado")} title="Aprovar" className="rounded-md border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50">
                          Aprovar
                        </button>
                      )}
                      <button onClick={() => askDelete(a)} className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50">
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && <p className="p-6 text-center text-xs text-zinc-400">Nenhum candidato encontrado.</p>}
        {loading && <p className="p-6 text-center text-xs text-zinc-400">Carregando...</p>}
      </div>

      {selected && (
        <Ficha app={selected} onClose={() => setSelected(null)} onStatus={askStatus} onDelete={askDelete} onChanged={load} waiting={waitingDays(selected)} />
      )}
      {editing && (
        <EditDialog
          app={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            setSelected(null);
            await load();
          }}
        />
      )}
      {pending && (
        <ConfirmDialog
          action={pending}
          onCancel={() => setPending(null)}
          onConfirm={async () => {
            const run = pending.run;
            setPending(null);
            await run();
          }}
        />
      )}
    </div>
  );
}

function Ficha({
  app,
  onClose,
  onStatus,
  onDelete,
  onChanged,
  waiting,
}: {
  app: Application;
  onClose: () => void;
  onStatus: (a: Application, s: ApplicationStatus) => void;
  onDelete: (a: Application) => void;
  onChanged: () => Promise<void>;
  waiting: number | null;
}) {
  const stage = stageOf(app);
  const [creating, setCreating] = useState(false);
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string; specialtyMatched: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createDoctor() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/doctor-applications/${app.id}/create-doctor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Falha ao criar o cadastro");
        return;
      }
      setCreated({ email: data.email, password: data.password, specialtyMatched: data.specialtyMatched });
      await onChanged();
    } finally {
      setCreating(false);
    }
  }

  const days = (app.available_days ?? []).join(", ");
  const shifts = (app.available_shifts ?? []).map((s) => SHIFTS.find((x) => x.key === s)?.label ?? s).join("/");
  const rows: [string, string | null | undefined][] = [
    ["E-mail", app.email],
    ["Telefone", app.whatsapp],
    ["Cidade", app.city ? `${app.city}${app.state ? ` - ${app.state}` : ""}` : app.state],
    ["Registro", registry(app) === "—" ? null : registry(app)],
    ["Como gostaria de colaborar", app.collaboration],
    ["Origem", app.origin === "organico" ? "Site (orgânico)" : "Formulário (tráfego pago)"],
    ["Recebido em", new Date(app.received_at ?? app.created_at).toLocaleString("pt-BR")],
    ["Disponibilidade", [days, shifts].filter(Boolean).join(" · ") || null],
    ["Valor pretendido", app.consult_price != null ? `R$ ${app.consult_price.toLocaleString("pt-BR")}` : null],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          {app.photo_url ? (
            <a href={app.photo_url} target="_blank" rel="noopener noreferrer" title="Ver foto em tamanho maior">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={app.photo_url} alt={app.name} className="h-14 w-14 shrink-0 rounded-full object-cover" />
            </a>
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-500">{initials(app.name)}</span>
          )}
          <div className="flex-1">
            <h3 className="text-base font-semibold text-zinc-900">{app.name}</h3>
            <p className="text-xs text-zinc-500">
              {profession(app)}
              {app.specialty ? ` · ${app.specialty}` : ""}
              {(app.specializations ?? []).length > 0 ? ` › ${(app.specializations ?? []).join(", ")}` : ""}
              {app.experience_years ? ` · ${app.experience_years} anos de experiência` : ""}
            </p>
            {waiting !== null && waiting >= 7 && <p className="mt-0.5 text-xs font-medium text-amber-700">Sem resposta há {waiting} dias</p>}
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_STYLE[stage]}`}>{STAGE_LABEL[stage]}</span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className={k === "Como gostaria de colaborar" || k === "Disponibilidade" ? "col-span-2" : ""}>
                <dt className="font-medium text-zinc-400">{k}</dt>
                <dd className="break-words text-zinc-700">{v}</dd>
              </div>
            ))}
          {app.comments && (
            <div className="col-span-2">
              <dt className="font-medium text-zinc-400">Comentários</dt>
              <dd className="whitespace-pre-wrap text-zinc-700">{app.comments}</dd>
            </div>
          )}
          {app.innovative_idea && (
            <div className="col-span-2">
              <dt className="font-medium text-zinc-400">Ideia inovadora</dt>
              <dd className="whitespace-pre-wrap text-zinc-700">{app.innovative_idea}</dd>
            </div>
          )}
          {app.presentation && (
            <div className="col-span-2">
              <dt className="font-medium text-zinc-400">Apresentação</dt>
              <dd className="whitespace-pre-wrap text-zinc-700">{app.presentation}</dd>
            </div>
          )}
        </dl>

        <div className="mt-5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Enviar e-mail (abre o seu e-mail já preenchido)</p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <a key={t.key} href={mailto(app, t)} className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50">
                {t.label}
              </a>
            ))}
          </div>
        </div>

        {app.status === "aprovado" && !app.doctor && !created && (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs text-emerald-800">Aprovado e ainda sem acesso à plataforma. O cadastro é criado com nome, e-mail, especialidade e registro desta candidatura.</p>
            <button onClick={() => setConfirmCreate(true)} disabled={creating} className="mt-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
              {creating ? "Criando..." : "Criar cadastro do médico"}
            </button>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          </div>
        )}
        {created && (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <p className="font-semibold">Cadastro criado. Repasse o acesso ao médico (a senha aparece só agora):</p>
            <p className="mt-1">
              E-mail: <b>{created.email}</b>
            </p>
            <p>
              Senha provisória: <b className="font-mono">{created.password}</b>
            </p>
            {!created.specialtyMatched && <p className="mt-1 text-amber-700">A especialidade não foi encontrada na lista da plataforma — escolha na tela de Médicos.</p>}
            <p className="mt-1">Falta completar CPF e endereço profissional na tela de Médicos.</p>
          </div>
        )}

        {confirmCreate && (
          <ConfirmDialog
            action={{
              title: "Criar cadastro do médico?",
              body: `Será criado o acesso à plataforma para ${app.name} (${app.email}), com senha provisória.`,
              label: "Criar cadastro",
              run: createDoctor,
            }}
            onCancel={() => setConfirmCreate(false)}
            onConfirm={async () => {
              setConfirmCreate(false);
              await createDoctor();
            }}
          />
        )}
        {error && app.status !== "aprovado" && <p className="mt-3 text-right text-xs text-red-600">{error}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button onClick={() => onDelete(app)} className="mr-auto rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
            Excluir
          </button>
          {APPLICATION_STATUSES.filter((s) => s !== app.status).map((s) => (
            <button key={s} onClick={() => onStatus(app, s)} className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
              Marcar como {STATUS_LABEL[s]}
            </button>
          ))}
          <button onClick={onClose} className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}


interface PendingAction {
  title: string;
  body: string;
  label: string;
  danger?: boolean;
  run: () => void | Promise<void>;
}

function ConfirmDialog({ action, onCancel, onConfirm }: { action: PendingAction; onCancel: () => void; onConfirm: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={(e) => { e.stopPropagation(); if (!busy) onCancel(); }}>
      <div role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-zinc-900">{action.title}</h3>
        <p className="mt-2 whitespace-pre-line text-sm text-zinc-600">{action.body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button disabled={busy} onClick={onCancel} className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
            Cancelar
          </button>
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${action.danger ? "bg-red-600" : "bg-brand-navy"}`}
          >
            {busy ? "Aguarde..." : action.label}
          </button>
        </div>
      </div>
    </div>
  );
}

const EDIT_FIELDS: { key: "name" | "email" | "profession" | "specialty" | "crm" | "crm_uf" | "whatsapp" | "city" | "state"; label: string }[] = [
  { key: "name", label: "Nome" },
  { key: "email", label: "E-mail" },
  { key: "profession", label: "Profissão" },
  { key: "specialty", label: "Especialidade" },
  { key: "crm", label: "Registro (número)" },
  { key: "crm_uf", label: "UF do registro" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "UF" },
];

function EditDialog({ app, onClose, onSaved }: { app: Application; onClose: () => void; onSaved: () => Promise<void> }) {
  const initial: Record<string, string> = {
    name: app.name ?? "",
    email: app.email ?? "",
    profession: app.profession ?? "Médico(a)",
    specialty: app.specialty ?? "",
    crm: app.crm ?? "",
    crm_uf: app.crm_uf ?? "",
    whatsapp: app.whatsapp ?? "",
    city: app.city ?? "",
    state: app.state ?? "",
  };
  const [vals, setVals] = useState(initial);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changes = EDIT_FIELDS.filter((f) => vals[f.key].trim() !== initial[f.key]);

  async function save() {
    const res = await fetch(`/api/admin/doctor-applications/${app.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: vals }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setAsking(false);
      setError(err.error ?? "Falha ao salvar alterações");
      return;
    }
    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-zinc-900">Editar candidato</h3>
        <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3">
          {EDIT_FIELDS.map((f) => (
            <label key={f.key} className="block text-xs font-medium text-zinc-500">
              {f.label}
              <input
                value={vals[f.key]}
                onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}
                className="mt-1 w-full rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs text-zinc-800 outline-none focus:border-brand-teal-dark"
              />
            </label>
          ))}
        </div>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
            Cancelar
          </button>
          <button
            disabled={changes.length === 0}
            onClick={() => setAsking(true)}
            className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Salvar alterações
          </button>
        </div>
      </div>
      {asking && (
        <ConfirmDialog
          action={{
            title: "Salvar alterações?",
            body: `Você vai alterar os dados de ${app.name}:\n${changes.map((f) => `• ${f.label}: ${initial[f.key] || "—"} → ${vals[f.key].trim() || "—"}`).join("\n")}`,
            label: "Confirmar e salvar",
            run: save,
          }}
          onCancel={() => setAsking(false)}
          onConfirm={save}
        />
      )}
    </div>
  );
}
