"use client";

import { useEffect, useState, useCallback } from "react";
import VitalSignsPanel from "./VitalSigns";
import TipoConsultaBadge, { TipoConsultaChoice, tipoSuffix } from "./TipoConsultaBadge";
import PatientTimeline from "./PatientTimeline";
import FinanceTab from "./FinanceTab";
import AttendanceHistoryTab from "./AttendanceHistoryTab";
import { printFile } from "@/lib/printPdf";
import type { TimelineDoc } from "@/lib/patientTimeline";
import {
  APPLICATION_STATUSES,
  SHIFTS,
  SPECIALTIES,
  type ApplicationStatus,
} from "@/lib/doctorApplications";

interface Specialty {
  id: string;
  name: string;
  monthly_quota: number;
}

interface Doctor {
  id: string;
  name: string;
  email: string;
  specialty_id: string | null;
  active: boolean;
  memed_email: string | null;
  memed_linked_at: string | null;
  cpf?: string | null;
  crm?: string | null;
  crm_uf?: string | null;
  rqe?: string | null;
  endereco_profissional?: string | null;
  consult_fee?: number | string | null;
  pix_key?: string | null;
  specialties: { name: string } | null;
}

interface Patient {
  id: string;
  full_name: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
}

interface Appointment {
  id: string;
  scheduled_at: string;
  status: string;
  access_token: string;
  queue_position?: number | null;
  tipo_consulta?: string | null;
  patients: { id: string; full_name: string } | null;
  doctors: { id: string; name: string } | null;
  specialties: { id: string; name: string } | null;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: "admin" | "atendente";
  active: boolean;
}

type Tab =
  | "dashboard"
  | "agenda"
  | "historico"
  | "financeiro"
  | "pacientes"
  | "medicos"
  | "captacao"
  | "especialidades"
  | "equipe";

interface DoctorApplication {
  id: string;
  name: string;
  crm: string;
  crm_uf: string;
  specialty: string;
  experience_years: number | null;
  email: string;
  whatsapp: string;
  city: string;
  state: string;
  consult_price: number | null;
  available_days: string[];
  available_shifts: string[];
  presentation: string | null;
  photo_url: string | null;
  status: ApplicationStatus;
  created_at: string;
}

interface DashboardData {
  totals: Record<string, number>;
  total: number;
  byDay: { date: string; count: number }[];
  bySpecialty: { name: string; count: number }[];
  byDoctor: { name: string; count: number }[];
  rangeDays: number;
}

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  faltou: "Faltou",
};

// ------------------------------------------------------------
// Ícones (mesmo estilo simples em SVG do painel de WhatsApp,
// sem depender de biblioteca externa)
// ------------------------------------------------------------
function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" strokeLinecap="round" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 19c.5-3 3-5 6.5-5s6 2 6.5 5" strokeLinecap="round" />
      <circle cx="17" cy="8.5" r="2.3" />
      <path d="M15.5 14.2c2.6.4 4.3 2 4.7 4.3" strokeLinecap="round" />
    </svg>
  );
}

function IconStethoscope() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M6 4v6a4 4 0 0 0 8 0V4" strokeLinecap="round" />
      <path d="M10 14v2a5 5 0 0 0 10 0v-1.5" strokeLinecap="round" />
      <circle cx="20" cy="13" r="1.6" />
      <path d="M6 4H4.5M14 4h1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconClipboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4.5V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" strokeLinecap="round" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4.5" strokeLinecap="round" />
    </svg>
  );
}

function IconTag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M11.5 3.5H5a1.5 1.5 0 0 0-1.5 1.5v6.5c0 .4.16.78.44 1.06l8 8a1.5 1.5 0 0 0 2.12 0l6.5-6.5a1.5 1.5 0 0 0 0-2.12l-8-8a1.5 1.5 0 0 0-1.06-.44Z" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="1.2" />
    </svg>
  );
}

function IconTeam() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <circle cx="12" cy="7.5" r="3.2" />
      <path d="M4.5 20c.7-4 3.5-6.5 7.5-6.5s6.8 2.5 7.5 6.5" strokeLinecap="round" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M4 20V10M11 20V4M18 20v-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 20h18" strokeLinecap="round" />
    </svg>
  );
}

function IconMoney() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path strokeLinecap="round" d="M6 9.5v5M18 9.5v5" />
    </svg>
  );
}

function IconHistory() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 2" />
    </svg>
  );
}

const NAV_ITEMS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "dashboard", label: "Dashboard", icon: <IconChart /> },
  { key: "agenda", label: "Agenda", icon: <IconCalendar /> },
  { key: "historico", label: "Histórico de atendimentos", icon: <IconHistory /> },
  { key: "financeiro", label: "Financeiro", icon: <IconMoney /> },
  { key: "pacientes", label: "Pacientes", icon: <IconUsers /> },
  { key: "medicos", label: "Médicos", icon: <IconStethoscope /> },
  { key: "captacao", label: "Captação", icon: <IconClipboard /> },
  { key: "especialidades", label: "Especialidades", icon: <IconTag /> },
  { key: "equipe", label: "Equipe", icon: <IconTeam /> },
];

function AdminSidebar({
  tab,
  onSelect,
  open,
  onClose,
}: {
  tab: Tab;
  onSelect: (t: Tab) => void;
  open: boolean;
  onClose: () => void;
}) {
  const [linksOpen, setLinksOpen] = useState(false);
  return (
    <nav
      className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 -translate-x-full flex-col border-r border-zinc-200 bg-white transition-transform duration-200 md:static md:z-auto md:w-56 md:translate-x-0 ${
        open ? "translate-x-0" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-4">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-facilitta.png" alt="Facilitta Saúde" className="h-7 w-7 rounded-md" />
          <span className="text-sm font-semibold leading-none text-brand-navy">
            facilitta<span className="text-brand-teal-dark"> saúde</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar menu"
          className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 md:hidden"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-4">
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          Administração
        </p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => {
                  onSelect(item.key);
                  onClose();
                }}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors ${
                  tab === item.key
                    ? "bg-brand-teal/15 text-brand-teal-dark"
                    : "text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
          {/* Mesmo visual dos outros itens, mas em vez de abrir uma tela
              mostra os links logo abaixo. */}
          <li>
            <button
              type="button"
              onClick={() => setLinksOpen((v) => !v)}
              aria-expanded={linksOpen}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors ${
                linksOpen ? "bg-zinc-50 text-brand-navy" : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <IconLink />
              Links
              <span className={`ml-auto text-xs text-zinc-400 transition-transform ${linksOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {linksOpen && (
              <ul className="mt-0.5 space-y-0.5 border-l border-zinc-200 pl-2 ml-4">
                {QUICK_LINKS.map((link) => (
                  <QuickLink key={link.path} {...link} />
                ))}
              </ul>
            )}
          </li>
        </ul>
      </div>
    </nav>
  );
}

/** Endereços de cada área do sistema, pra abrir ou copiar e mandar pra quem usa. */
const QUICK_LINKS: { label: string; path: string; hint: string }[] = [
  { label: "Admin", path: "/admin", hint: "Painel da administração" },
  { label: "Médico", path: "/medico", hint: "Área do médico (pede login)" },
  { label: "Cabine", path: "/atendimento", hint: "Tela da cabine de atendimento presencial" },
  { label: "Atendimento", path: "/atendente", hint: "Painel da atendente (pede login da equipe)" },
];

function QuickLink({ label, path, hint }: { label: string; path: string; hint: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt("Copie o link:", `${window.location.origin}${path}`);
    }
  }

  return (
    <li className="flex items-center gap-1">
      <a
        href={path}
        target="_blank"
        rel="noopener noreferrer"
        title={hint}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
      >
        <span className="truncate">{label}</span>
        <span className="ml-auto text-[10px] text-zinc-400">↗</span>
      </a>
      <button
        type="button"
        onClick={copy}
        title={`Copiar o link de ${label}`}
        aria-label={`Copiar o link de ${label}`}
        className="shrink-0 rounded-md px-1.5 py-1 text-[11px] font-semibold text-brand-teal-dark hover:bg-brand-teal/10"
      >
        {copied ? "✓" : "Copiar"}
      </button>
    </li>
  );
}

function IconLink() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1m-2 6a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-brand-bg">
      <AdminSidebar tab={tab} onSelect={setTab} open={navOpen} onClose={() => setNavOpen(false)} />

      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-3 border-b border-brand-navy bg-brand-navy px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Abrir menu"
            className="rounded-md p-1 text-white hover:bg-white/10 md:hidden"
          >
            <IconMenu />
          </button>
          <h1 className="text-sm font-semibold text-white">
            Administração — Facilitta Telemedicina
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className={tab === "historico" || tab === "financeiro" ? "mx-auto max-w-6xl" : tab === "dashboard" ? "mx-auto max-w-5xl" : "mx-auto max-w-4xl"}>
            {tab === "dashboard" && <DashboardTab />}
            {tab === "especialidades" && <SpecialtiesTab />}
            {tab === "medicos" && <DoctorsTab />}
            {tab === "captacao" && <CaptacaoTab />}
            {tab === "pacientes" && <PatientsTab />}
            {tab === "agenda" && <AgendaTab />}
            {tab === "historico" && (
              <AttendanceHistoryTab renderPatientHistory={(id) => <PatientHistoryPanel patientId={id} />} />
            )}
            {tab === "financeiro" && <FinanceTab />}
            {tab === "equipe" && <StaffTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Dashboard
// ------------------------------------------------------------
const STATUS_CHART_LABELS: Record<string, string> = {
  concluido: "Concluídos",
  em_andamento: "Em andamento",
  agendado: "Aguardando",
  faltou: "Faltas",
  cancelado: "Cancelados",
};

// Cores de status são reservadas (nunca reaproveitadas por outro
// gráfico) e sempre vêm com o rótulo ao lado, nunca só a cor.
const STATUS_CHART_COLORS: Record<string, string> = {
  concluido: "#009594", // brand-teal-dark — bom
  em_andamento: "#d97706", // amber-600 — em curso
  agendado: "#a1a1aa", // zinc-400 — neutro/aguardando
  faltou: "#ea580c", // orange-600 — atenção
  cancelado: "#dc2626", // red-600 — crítico
};

const STATUS_CHART_ORDER = ["concluido", "em_andamento", "agendado", "faltou", "cancelado"] as const;

function formatShortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
}

/**
 * Cartão de KPI simples — número grande + rótulo, sem gráfico. Uso: o
 * headline que não precisa de forma nenhuma (checks do dataviz).
 */
function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold" style={{ color: accent ?? "#15004d" }}>
        {value}
      </p>
    </div>
  );
}

/**
 * Barra empilhada horizontal 100% mostrando a distribuição de status —
 * uma faixa por status, sempre com legenda (cor nunca sozinha).
 */
function StatusStackedBar({ totals, total }: { totals: Record<string, number>; total: number }) {
  if (total === 0) {
    return <p className="text-xs text-zinc-400">Sem atendimentos no período.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex h-6 w-full overflow-hidden rounded-full bg-zinc-100">
        {STATUS_CHART_ORDER.map((key) => {
          const count = totals[key] ?? 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={key}
              style={{ width: `${pct}%`, backgroundColor: STATUS_CHART_COLORS[key] }}
              className="h-full first:rounded-l-full last:rounded-r-full"
              title={`${STATUS_CHART_LABELS[key]}: ${count} (${pct.toFixed(0)}%)`}
            />
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {STATUS_CHART_ORDER.map((key) => {
          const count = totals[key] ?? 0;
          return (
            <li key={key} className="flex items-center gap-1.5 text-xs text-zinc-600">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_CHART_COLORS[key] }}
              />
              {STATUS_CHART_LABELS[key]}
              <span className="font-medium text-zinc-800">{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Gráfico de barras verticais (evolução diária). Marcas finas, cantos
 * arredondados nas pontas, grade recessiva, tooltip por barra.
 */
function DailyBarChart({ data }: { data: { date: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const width = 720;
  const height = 160;
  const padding = { top: 8, bottom: 20, left: 4, right: 4 };
  const plotHeight = height - padding.top - padding.bottom;
  const barGap = 3;
  const barWidth = (width - padding.left - padding.right) / data.length - barGap;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-40 w-full min-w-[560px]"
        role="img"
        aria-label="Atendimentos por dia nos últimos 30 dias"
      >
        {/* grade recessiva (25/50/75/100%) */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotHeight * (1 - f)}
            y2={padding.top + plotHeight * (1 - f)}
            stroke="#e4e4e7"
            strokeWidth={1}
          />
        ))}
        {data.map((d, i) => {
          const x = padding.left + i * (barWidth + barGap);
          const h = max === 0 ? 0 : (d.count / max) * plotHeight;
          const y = padding.top + plotHeight - h;
          const isHover = hover === i;
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={Math.max(barWidth, 1)}
                height={Math.max(h, 1)}
                rx={2}
                fill={isHover ? "#009594" : "#00e2c3"}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((cur) => (cur === i ? null : cur))}
              >
                <title>{`${formatShortDate(d.date)}: ${d.count} atendimento${d.count === 1 ? "" : "s"}`}</title>
              </rect>
              {(i === 0 || i === data.length - 1 || i % 5 === 0) && (
                <text
                  x={x + barWidth / 2}
                  y={height - 4}
                  fontSize={9}
                  textAnchor="middle"
                  fill="#a1a1aa"
                >
                  {formatShortDate(d.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Ranking em barras horizontais (especialidade / médico) — magnitude,
 * então uma única cor (não é comparação de identidade entre séries).
 */
function RankedBarChart({ data, emptyLabel }: { data: { name: string; count: number }[]; emptyLabel: string }) {
  if (data.length === 0) {
    return <p className="text-xs text-zinc-400">{emptyLabel}</p>;
  }
  const max = Math.max(...data.map((d) => d.count));
  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.name} className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 truncate text-zinc-600" title={d.name}>
            {d.name}
          </span>
          <div className="h-3 flex-1 rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-brand-teal-dark"
              style={{ width: `${max === 0 ? 0 : (d.count / max) * 100}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right font-medium text-zinc-800">{d.count}</span>
        </li>
      ))}
    </ul>
  );
}

function DashboardTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/dashboard");
      if (!res.ok) {
        setError(true);
        return;
      }
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  if (loading) return <p className="text-xs text-zinc-400">Carregando dashboard...</p>;
  if (error || !data) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-red-600">Falha ao carregar os dados do dashboard.</p>
        <button
          onClick={load}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  const finalizados = data.totals.concluido ?? 0;
  const emAberto = (data.totals.agendado ?? 0) + (data.totals.em_andamento ?? 0);
  const naoCompareceu = (data.totals.faltou ?? 0) + (data.totals.cancelado ?? 0);
  const taxaComparecimento =
    finalizados + naoCompareceu > 0
      ? `${Math.round((finalizados / (finalizados + naoCompareceu)) * 100)}%`
      : "—";

  return (
    <div className="space-y-6">
      <p className="text-xs text-zinc-400">Últimos {data.rangeDays} dias</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total de atendimentos" value={data.total} />
        <StatCard label="Concluídos" value={finalizados} accent="#009594" />
        <StatCard label="Em aberto" value={emAberto} accent="#d97706" />
        <StatCard label="Taxa de comparecimento" value={taxaComparecimento} />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Atendimentos por dia (últimos 30 dias)
        </p>
        <DailyBarChart data={data.byDay} />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Status dos atendimentos
        </p>
        <StatusStackedBar totals={data.totals} total={data.total} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Por especialidade
          </p>
          <RankedBarChart data={data.bySpecialty} emptyLabel="Sem atendimentos no período." />
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Por médico
          </p>
          <RankedBarChart data={data.byDoctor} emptyLabel="Sem atendimentos no período." />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Especialidades
// ------------------------------------------------------------
function SpecialtiesTab() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [name, setName] = useState("");
  const [quota, setQuota] = useState("50");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editQuota, setEditQuota] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/specialties");
    if (res.ok) setSpecialties((await res.json()).specialties);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/specialties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, monthlyQuota: Number(quota) || 50 }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }
      setName("");
      setQuota("50");
      await load();
    } finally {
      setSaving(false);
    }
  }

  function startEdit(s: Specialty) {
    setEditingId(s.id);
    setEditName(s.name);
    setEditQuota(String(s.monthly_quota));
  }

  async function handleDelete(s: Specialty) {
    if (!confirm(`Excluir a especialidade "${s.name}"? Essa ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/admin/specialties/${s.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error);
      return;
    }
    await load();
  }

  async function saveEdit(id: string) {
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/specialties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, monthlyQuota: Number(editQuota) || 1 }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }
      const saved = await res.json().catch(() => ({}));
      if (saved.warning) alert(saved.warning);
      setEditingId(null);
      await load();
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Nome</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
            placeholder="Ex: Cardiologia"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Cota mensal</span>
          <input
            type="number"
            min={1}
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
            className="w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
        <button
          disabled={saving}
          className="rounded-md bg-brand-navy px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Adicionar
        </button>
      </form>

      <ul className="space-y-2">
        {specialties.map((s) =>
          editingId === s.id ? (
            <li
              key={s.id}
              className="flex flex-wrap items-end gap-3 rounded-md border border-brand-teal-dark bg-white px-4 py-3 text-sm"
            >
              <label className="text-xs">
                <span className="mb-1 block font-medium text-zinc-600">Nome</span>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-zinc-600">Cota mensal</span>
                <input
                  type="number"
                  min={1}
                  value={editQuota}
                  onChange={(e) => setEditQuota(e.target.value)}
                  className="w-28 rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                />
              </label>
              <button
                onClick={() => saveEdit(s.id)}
                disabled={editSaving}
                className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Salvar
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
              >
                Cancelar
              </button>
            </li>
          ) : (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm"
            >
              <div>
                <span className="font-medium text-zinc-800">{s.name}</span>
                <span className="ml-2 text-xs text-zinc-500">{s.monthly_quota} consultas/mês</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => startEdit(s)}
                  className="rounded-md border border-zinc-300 px-2.5 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(s)}
                  className="rounded-md border border-red-200 px-2.5 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50"
                >
                  Excluir
                </button>
              </div>
            </li>
          )
        )}
        {specialties.length === 0 && (
          <p className="text-xs text-zinc-400">Nenhuma especialidade cadastrada.</p>
        )}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------
// Médicos
// ------------------------------------------------------------
/** Saldo de assinaturas digitais (créditos do serviço de assinatura). */
function SigningCreditsCard() {
  const [credits, setCredits] = useState<number | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/signing-credits")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setCredits(typeof d.credits === "number" ? d.credits : null);
        setError(d.error ?? null);
      })
      .catch(() => !cancelled && setCredits(null));
    return () => {
      cancelled = true;
    };
  }, []);

  const low = typeof credits === "number" && credits < 10;
  return (
    <div
      className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
        low ? "border-amber-300 bg-amber-50" : "border-zinc-200 bg-white"
      }`}
    >
      <span className="font-medium text-zinc-700">Assinaturas digitais disponíveis</span>
      <span className={`text-base font-semibold ${low ? "text-amber-700" : "text-brand-navy"}`}>
        {credits === undefined
          ? "…"
          : typeof credits === "number"
            ? `${credits}${low ? " · comprar mais créditos" : ""}`
            : error
              ? "indisponível"
              : "—"}
      </span>
    </div>
  );
}

/** Mostra se o CPF do médico tem certificado em nuvem (VIDaaS/BirdID) pra assinar receitas. */
function CertificateBadge({ doctorId, cpf }: { doctorId: string; cpf?: string | null }) {
  const [info, setInfo] = useState<{ status: string; providers?: string[] } | null>(null);

  useEffect(() => {
    if (!cpf) return;
    let cancelled = false;
    fetch(`/api/admin/doctors/${doctorId}/certificate`)
      .then((r) => r.json())
      .then((d) => !cancelled && setInfo(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [doctorId, cpf]);

  if (!cpf) return null;
  if (!info) return <span className="text-zinc-400">· verificando certificado…</span>;
  if (info.status === "ok") {
    const names = (info.providers ?? []).map((p) => (p === "vidaas" ? "VIDaaS" : p === "birdid" ? "BirdID" : p));
    return (
      <span className="rounded-full bg-brand-teal/15 px-2 py-0.5 font-medium text-brand-teal-dark">
        Certificado {names.join(" + ") || "encontrado"}
      </span>
    );
  }
  if (info.status === "nenhum") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800">
        Nenhum certificado em nuvem nesse CPF
      </span>
    );
  }
  return <span className="text-zinc-400">· não foi possível verificar o certificado</span>;
}

/** Valor por consulta como aparece no campo (ex: "70,00"); vazio se não cadastrado. */
function feeInput(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2).replace(".", ",") : "";
}

function DoctorsTab() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", specialtyId: "", cpf: "", crm: "", crmUf: "", rqe: "", enderecoProfissional: "", consultFee: "", pixKey: "" });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", specialtyId: "", password: "", cpf: "", crm: "", crmUf: "", rqe: "", enderecoProfissional: "", consultFee: "", pixKey: "" });
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    const [dRes, sRes] = await Promise.all([
      fetch("/api/admin/doctors"),
      fetch("/api/admin/specialties"),
    ]);
    if (dRes.ok) setDoctors((await dRes.json()).doctors);
    if (sRes.ok) setSpecialties((await sRes.json()).specialties);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }
      const created = await res.json().catch(() => ({}));
      if (created.warning) alert(created.warning);
      setForm({ name: "", email: "", password: "", specialtyId: "", cpf: "", crm: "", crmUf: "", rqe: "", enderecoProfissional: "", consultFee: "", pixKey: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(doctor: Doctor) {
    await fetch(`/api/admin/doctors/${doctor.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !doctor.active }),
    });
    await load();
  }

  function startEdit(d: Doctor) {
    setEditingId(d.id);
    setEditForm({
      name: d.name,
      email: d.email,
      specialtyId: d.specialty_id ?? "",
      password: "",
      cpf: d.cpf ?? "",
      crm: d.crm ?? "",
      crmUf: d.crm_uf ?? "",
      rqe: d.rqe ?? "",
      enderecoProfissional: d.endereco_profissional ?? "",
      consultFee: feeInput(d.consult_fee),
      pixKey: d.pix_key ?? "",
    });
  }

  async function handleDelete(d: Doctor) {
    if (!confirm(`Excluir o médico "${d.name}"? Essa ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/admin/doctors/${d.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error);
      return;
    }
    await load();
  }

  async function saveEdit(id: string) {
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editForm.name,
        email: editForm.email,
        specialtyId: editForm.specialtyId,
        cpf: editForm.cpf,
        crm: editForm.crm,
        crmUf: editForm.crmUf,
        rqe: editForm.rqe,
        enderecoProfissional: editForm.enderecoProfissional,
        consultFee: editForm.consultFee,
        pixKey: editForm.pixKey,
      };
      if (editForm.password) body.password = editForm.password;
      const res = await fetch(`/api/admin/doctors/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }
      // Ex.: valor por consulta não gravado porque falta a migração no banco.
      const saved = await res.json().catch(() => ({}));
      if (saved.warning) alert(saved.warning);
      setEditingId(null);
      await load();
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <SigningCreditsCard />
      <form onSubmit={handleCreate} className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2">
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Nome</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">E-mail (login)</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Senha provisória</span>
          <input
            required
            type="text"
            minLength={6}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
            placeholder="mín. 6 caracteres"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Especialidade</span>
          <select
            value={form.specialtyId}
            onChange={(e) => setForm((f) => ({ ...f, specialtyId: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          >
            <option value="">—</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-4">
          <label className="text-xs">
            <span className="mb-1 block font-medium text-zinc-600">CPF (receita digital)</span>
            <input
              value={form.cpf}
              onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))}
              placeholder="só números"
              inputMode="numeric"
              className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-zinc-600">CRM</span>
            <input
              value={form.crm}
              onChange={(e) => setForm((f) => ({ ...f, crm: e.target.value }))}
              inputMode="numeric"
              className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-zinc-600">UF do CRM</span>
            <input
              value={form.crmUf}
              onChange={(e) => setForm((f) => ({ ...f, crmUf: e.target.value.toUpperCase() }))}
              maxLength={2}
              placeholder="BA"
              className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
            />
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-zinc-600">RQE (especialista)</span>
            <input
              value={form.rqe}
              onChange={(e) => setForm((f) => ({ ...f, rqe: e.target.value }))}
              placeholder="opcional"
              inputMode="numeric"
              className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
            />
          </label>
          <label className="text-xs sm:col-span-4">
            <span className="mb-1 block font-medium text-zinc-600">Endereço profissional (sai na receita)</span>
            <input
              value={form.enderecoProfissional}
              onChange={(e) => setForm((f) => ({ ...f, enderecoProfissional: e.target.value }))}
              placeholder="Rua, número, bairro, cidade/UF, CEP"
              maxLength={200}
              className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
            />
          </label>
          <label className="text-xs sm:col-span-2">
            <span className="mb-1 block font-medium text-zinc-600">Valor por consulta (R$)</span>
            <input
              value={form.consultFee}
              onChange={(e) => setForm((f) => ({ ...f, consultFee: e.target.value }))}
              placeholder="ex: 70,00"
              inputMode="decimal"
              className="w-full max-w-xs rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
            />
            <span className="mt-1 block text-[11px] text-zinc-400">Vale para as próximas consultas concluídas; as já concluídas mantêm o valor da época.</span>
          </label>
          <label className="text-xs sm:col-span-2">
            <span className="mb-1 block font-medium text-zinc-600">Chave PIX (repasse)</span>
            <input
              value={form.pixKey}
              onChange={(e) => setForm((f) => ({ ...f, pixKey: e.target.value }))}
              placeholder="CPF/CNPJ, e-mail, celular ou aleatória"
              maxLength={140}
              className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
            />
            <span className="mt-1 block text-[11px] text-zinc-400">O médico também pode preencher em Meu cadastro.</span>
          </label>
        </div>
        <div className="sm:col-span-2">
          <button
            disabled={saving}
            className="rounded-md bg-brand-navy px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Cadastrar médico
          </button>
        </div>
      </form>

      <ul className="space-y-2">
        {doctors.map((d) =>
          editingId === d.id ? (
            <li
              key={d.id}
              className="grid gap-3 rounded-md border border-brand-teal-dark bg-white p-4 text-sm sm:grid-cols-2"
            >
              <label className="text-xs">
                <span className="mb-1 block font-medium text-zinc-600">Nome</span>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-zinc-600">E-mail (login)</span>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-zinc-600">Especialidade</span>
                <select
                  value={editForm.specialtyId}
                  onChange={(e) => setEditForm((f) => ({ ...f, specialtyId: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                >
                  <option value="">—</option>
                  {specialties.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-zinc-600">Nova senha (opcional)</span>
                <input
                  type="text"
                  minLength={6}
                  value={editForm.password}
                  onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                  placeholder="deixe em branco pra manter"
                />
              </label>
              <div className="grid gap-3 sm:col-span-2 sm:grid-cols-4">
                <label className="text-xs">
                  <span className="mb-1 block font-medium text-zinc-600">CPF (receita digital)</span>
                  <input
                    value={editForm.cpf}
                    onChange={(e) => setEditForm((f) => ({ ...f, cpf: e.target.value }))}
                    placeholder="só números"
                    inputMode="numeric"
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block font-medium text-zinc-600">CRM</span>
                  <input
                    value={editForm.crm}
                    onChange={(e) => setEditForm((f) => ({ ...f, crm: e.target.value }))}
                    inputMode="numeric"
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block font-medium text-zinc-600">UF do CRM</span>
                  <input
                    value={editForm.crmUf}
                    onChange={(e) => setEditForm((f) => ({ ...f, crmUf: e.target.value.toUpperCase() }))}
                    maxLength={2}
                    placeholder="BA"
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                  />
                </label>
                <label className="text-xs">
                  <span className="mb-1 block font-medium text-zinc-600">RQE (especialista)</span>
                  <input
                    value={editForm.rqe}
                    onChange={(e) => setEditForm((f) => ({ ...f, rqe: e.target.value }))}
                    placeholder="opcional"
                    inputMode="numeric"
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                  />
                </label>
                <label className="text-xs sm:col-span-4">
                  <span className="mb-1 block font-medium text-zinc-600">Endereço profissional (sai na receita)</span>
                  <input
                    value={editForm.enderecoProfissional}
                    onChange={(e) => setEditForm((f) => ({ ...f, enderecoProfissional: e.target.value }))}
                    placeholder="Rua, número, bairro, cidade/UF, CEP"
                    maxLength={200}
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                  />
                </label>
                <label className="text-xs sm:col-span-2">
                  <span className="mb-1 block font-medium text-zinc-600">Valor por consulta (R$)</span>
                  <input
                    value={editForm.consultFee}
                    onChange={(e) => setEditForm((f) => ({ ...f, consultFee: e.target.value }))}
                    placeholder="ex: 70,00"
                    inputMode="decimal"
                    className="w-full max-w-xs rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                  />
                  <span className="mt-1 block text-[11px] text-zinc-400">Vale para as próximas consultas concluídas; as já concluídas mantêm o valor da época.</span>
                </label>
                <label className="text-xs sm:col-span-2">
                  <span className="mb-1 block font-medium text-zinc-600">Chave PIX (repasse)</span>
                  <input
                    value={editForm.pixKey}
                    onChange={(e) => setEditForm((f) => ({ ...f, pixKey: e.target.value }))}
                    placeholder="CPF/CNPJ, e-mail, celular ou aleatória"
                    maxLength={140}
                    className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                  />
                  <span className="mt-1 block text-[11px] text-zinc-400">O médico também pode preencher em Meu cadastro.</span>
                </label>
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <button
                  onClick={() => saveEdit(d.id)}
                  disabled={editSaving}
                  className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
              </div>
            </li>
          ) : (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm"
            >
              <div>
                <p className="font-medium text-zinc-800">{d.name}</p>
                <p className="text-xs text-zinc-500">
                  {d.email} {d.specialties?.name ? `· ${d.specialties.name}` : ""}
                  {feeInput(d.consult_fee) ? ` · R$ ${feeInput(d.consult_fee)} por consulta` : " · sem valor por consulta"}
                  {d.pix_key ? ` · PIX: ${d.pix_key}` : ""}
                </p>
                {d.cpf && d.crm && d.crm_uf ? (
                  <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-brand-teal-dark">
                    Receita digital: CRM-{d.crm_uf} {d.crm}
                    {d.rqe ? ` · RQE ${d.rqe}` : ""}
                    {!d.endereco_profissional && <span className="text-amber-700">· falta endereço profissional</span>}
                    <CertificateBadge doctorId={d.id} cpf={d.cpf} />
                  </p>
                ) : (
                  <p className="text-[11px] text-amber-700">
                    Receita digital: falta CPF/CRM (clique em Editar)
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => startEdit(d)}
                  className="rounded-md border border-zinc-300 px-2.5 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(d)}
                  className="rounded-md border border-red-200 px-2.5 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50"
                >
                  Excluir
                </button>
                <button
                  onClick={() => toggleActive(d)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                    d.active ? "bg-brand-teal/15 text-brand-teal-dark" : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {d.active ? "Ativo" : "Inativo"}
                </button>
              </div>
            </li>
          )
        )}
        {doctors.length === 0 && (
          <p className="text-xs text-zinc-400">Nenhum médico cadastrado.</p>
        )}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------
// Pacientes
// ------------------------------------------------------------
interface PatientHistoryItem {
  tipo_consulta?: string | null;
  id: string;
  scheduled_at: string;
  status: string;
  called_at: string | null;
  finished_at: string | null;
  doctor_notes: string | null;
  prescription_url: string | null;
  memed_prescription_at: string | null;
  memed_prescription_summary: string | null;
  vital_spo2: string | null;
  vital_bpm: string | null;
  vital_pa: string | null;
  vital_peso: string | null;
  vital_hgt: string | null;
  doctors: { name: string } | null;
  specialties: { name: string } | null;
}

const VITAL_HISTORY_LABELS: [key: "vital_spo2" | "vital_bpm" | "vital_pa" | "vital_peso" | "vital_hgt", label: string][] = [
  ["vital_spo2", "SpO2"],
  ["vital_bpm", "BPM"],
  ["vital_pa", "PA"],
  ["vital_peso", "Peso"],
  ["vital_hgt", "HGT"],
];

function formatHistoryTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Duração entre início e fim do atendimento, em minutos (ou h/min). */
function formatHistoryDuration(startIso: string, endIso: string) {
  const minutes = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}h${rest > 0 ? ` ${rest}min` : ""}`;
}

/**
 * Histórico médico completo do paciente — toda consulta já feita, com
 * data, horário de início/fim, duração e tudo que a médica registrou
 * (anotações, receita), independente de qual médico atendeu. Carrega
 * sob demanda quando o admin abre o histórico daquele paciente.
 */
function PatientHistoryPanel({ patientId }: { patientId: string }) {
  const [history, setHistory] = useState<PatientHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [documents, setDocuments] = useState<TimelineDoc[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/admin/patients/${patientId}/history`);
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = await res.json();
      setHistory(data.history ?? []);
      const docsRes = await fetch(`/api/admin/patients/${patientId}/documents`);
      if (docsRes.ok) setDocuments((await docsRes.json()).files ?? []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  if (loading) return <p className="text-xs text-zinc-400">Carregando histórico...</p>;
  if (error) return <p className="text-xs text-red-600">Falha ao carregar o histórico médico.</p>;

  const byId = new Map((history ?? []).map((h) => [h.id, h]));
  const details = (id: string) => {
    const h = byId.get(id);
    if (!h) return null;
    const hasVitals = VITAL_HISTORY_LABELS.some(([key]) => h[key]);
    return (
      <div className="mt-2 space-y-1.5 rounded-md bg-zinc-50 px-3 py-2 text-xs">
        <p className="text-zinc-500">
          {h.called_at ? `Início ${formatHistoryTime(h.called_at)}` : "Início não registrado"}
          {h.finished_at ? ` · Fim ${formatHistoryTime(h.finished_at)}` : ""}
          {h.called_at && h.finished_at ? ` · Duração ${formatHistoryDuration(h.called_at, h.finished_at)}` : ""}
        </p>
        {hasVitals && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-zinc-600">
            {VITAL_HISTORY_LABELS.filter(([key]) => h[key]).map(([key, label]) => (
              <span key={key}>
                <span className="font-medium text-zinc-500">{label}:</span> {h[key]}
              </span>
            ))}
          </div>
        )}
        {h.doctor_notes && <p className="whitespace-pre-wrap text-zinc-700">{h.doctor_notes}</p>}
        {h.prescription_url && (
          <a href={h.prescription_url} target="_blank" rel="noreferrer" className="inline-block text-brand-teal-dark underline">
            Ver receita
          </a>
        )}
        {h.memed_prescription_summary && (
          <p className="text-brand-teal-dark">
            {h.memed_prescription_summary}
            {h.memed_prescription_at ? ` · ${formatHistoryTime(h.memed_prescription_at)}` : ""}
          </p>
        )}
      </div>
    );
  };

  async function removeDoc(doc: TimelineDoc) {
    if (!confirm(`Remover "${doc.name}"?`)) return;
    const res = await fetch(`/api/admin/patients/${patientId}/documents`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: doc.path }),
    });
    if (res.ok) setDocuments((await res.json()).files ?? []);
  }

  return (
    <PatientTimeline
      appointments={(history ?? []).map((h) => ({
        id: h.id,
        scheduled_at: h.scheduled_at,
        status: h.status,
        doctorName: h.doctors?.name ?? null,
        specialty: (h.specialties?.name ?? "") + tipoSuffix(h.tipo_consulta) || null,
      }))}
      documents={documents}
      renderDetails={details}
      onPrint={(d) => d.url && printFile(d.url, d.name)}
      onRemove={removeDoc}
    />
  );
}

function PatientsTab() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    cpf: "",
    birthDate: "",
    phone: "",
    email: "",
    city: "",
    state: "",
  });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    cpf: "",
    phone: "",
    email: "",
    city: "",
    state: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async (q?: string) => {
    const res = await fetch(`/api/admin/patients${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    if (res.ok) setPatients((await res.json()).patients);
  }, []);

  function toggleHistory(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }
      setForm({ fullName: "", cpf: "", birthDate: "", phone: "", email: "", city: "", state: "" });
      await load(search);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(p: Patient) {
    setEditingId(p.id);
    setEditForm({
      fullName: p.full_name,
      cpf: p.cpf ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      city: p.city ?? "",
      state: p.state ?? "",
    });
  }

  async function handleDelete(p: Patient) {
    if (
      !confirm(
        `Excluir o paciente "${p.full_name}"? Isso também apaga todo o histórico de consultas dele. Essa ação não pode ser desfeita.`
      )
    )
      return;
    const res = await fetch(`/api/admin/patients/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error);
      return;
    }
    await load(search);
  }

  async function saveEdit(id: string) {
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/patients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }
      setEditingId(null);
      await load(search);
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2">
        <label className="text-xs sm:col-span-2">
          <span className="mb-1 block font-medium text-zinc-600">Nome completo</span>
          <input
            required
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">CPF</span>
          <input
            value={form.cpf}
            onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Nascimento</span>
          <input
            type="date"
            value={form.birthDate}
            onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Telefone</span>
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">E-mail</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Cidade</span>
          <input
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">UF</span>
          <input
            maxLength={2}
            value={form.state}
            onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))}
            className="w-24 rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            disabled={saving}
            className="rounded-md bg-brand-navy px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Cadastrar paciente
          </button>
        </div>
      </form>

      <div className="flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            load(e.target.value);
          }}
          placeholder="Buscar por nome ou CPF..."
          className="w-full max-w-sm rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
        />
      </div>

      <ul className="space-y-2">
        {patients.map((p) =>
          editingId === p.id ? (
            <li
              key={p.id}
              className="grid gap-3 rounded-md border border-brand-teal-dark bg-white p-4 text-sm sm:grid-cols-2"
            >
              <label className="text-xs sm:col-span-2">
                <span className="mb-1 block font-medium text-zinc-600">Nome completo</span>
                <input
                  value={editForm.fullName}
                  onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-zinc-600">CPF</span>
                <input
                  value={editForm.cpf}
                  onChange={(e) => setEditForm((f) => ({ ...f, cpf: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-zinc-600">Telefone</span>
                <input
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-zinc-600">E-mail</span>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-zinc-600">Cidade</span>
                <input
                  value={editForm.city}
                  onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-zinc-600">UF</span>
                <input
                  maxLength={2}
                  value={editForm.state}
                  onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value.toUpperCase() }))}
                  className="w-24 rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <button
                  onClick={() => saveEdit(p.id)}
                  disabled={editSaving}
                  className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
              </div>
            </li>
          ) : (
            <li
              key={p.id}
              className="rounded-md border border-zinc-200 bg-white text-sm"
            >
              <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-800">{p.full_name}</p>
                  <p className="text-xs text-zinc-500">
                    {p.cpf ? `CPF ${p.cpf} · ` : ""}
                    {p.phone ?? p.email ?? ""}
                    {p.city ? ` · ${p.city}${p.state ? `/${p.state}` : ""}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => toggleHistory(p.id)}
                    className={`rounded-md border px-2.5 py-1 text-[10px] font-medium ${
                      expandedId === p.id
                        ? "border-brand-teal-dark bg-brand-teal/10 text-brand-teal-dark"
                        : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    {expandedId === p.id ? "Ocultar histórico" : "Histórico e documentos"}
                  </button>
                  <button
                    onClick={() => startEdit(p)}
                    className="rounded-md border border-zinc-300 px-2.5 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(p)}
                    className="rounded-md border border-red-200 px-2.5 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50"
                  >
                    Excluir
                  </button>
                </div>
              </div>
              {expandedId === p.id && (
                <div className="border-t border-zinc-100 px-4 pb-3 pt-2">
                  <p className="text-xs font-semibold text-brand-navy">❤ Sinais vitais</p>
                  <VitalSignsPanel patientId={p.id} />
                  <div className="mt-4" />
                  <PatientHistoryPanel patientId={p.id} />
                </div>
              )}
            </li>
          )
        )}
        {patients.length === 0 && (
          <p className="text-xs text-zinc-400">Nenhum paciente encontrado.</p>
        )}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------
// Agenda
// ------------------------------------------------------------
function AgendaTab() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [form, setForm] = useState({ patientId: "", doctorId: "", specialtyId: "", scheduledDate: "", tipoConsulta: "" });
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ doctorId: "", scheduledDate: "", tipoConsulta: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [boothCopied, setBoothCopied] = useState(false);
  const [scheduledPatientIds, setScheduledPatientIds] = useState<Set<string>>(new Set());

  // Busca quem já está agendado nessa data pra essa especialidade, pra
  // tirar da lista de seleção (evita marcar o mesmo paciente duas vezes
  // na mesma especialidade no mesmo dia).
  useEffect(() => {
    if (!form.specialtyId || !form.scheduledDate) {
      const timeout = setTimeout(() => setScheduledPatientIds(new Set()), 0);
      return () => clearTimeout(timeout);
    }
    let cancelled = false;
    fetch(
      `/api/admin/appointments/scheduled-patients?date=${form.scheduledDate}&specialtyId=${form.specialtyId}`
    )
      .then((res) => (res.ok ? res.json() : { patientIds: [] }))
      .then((data) => {
        if (!cancelled) setScheduledPatientIds(new Set(data.patientIds ?? []));
      })
      .catch(() => {
        if (!cancelled) setScheduledPatientIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [form.specialtyId, form.scheduledDate]);

  function copyBoothLink() {
    const url = `${window.location.origin}/atendimento`;
    navigator.clipboard.writeText(url).then(() => {
      setBoothCopied(true);
      setTimeout(() => setBoothCopied(false), 2000);
    });
  }

  const load = useCallback(async () => {
    const [aRes, pRes, dRes, sRes] = await Promise.all([
      fetch("/api/admin/appointments"),
      fetch("/api/admin/patients"),
      fetch("/api/admin/doctors"),
      fetch("/api/admin/specialties"),
    ]);
    if (aRes.ok) setAppointments((await aRes.json()).appointments);
    if (pRes.ok) setPatients((await pRes.json()).patients);
    if (dRes.ok) setDoctors((await dRes.json()).doctors);
    if (sRes.ok) setSpecialties((await sRes.json()).specialties);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tipoConsulta) {
      alert("Marque se é primeiro atendimento (rotina) ou retorno.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }
      setForm({ patientId: "", doctorId: "", specialtyId: "", scheduledDate: "", tipoConsulta: "" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm("Cancelar essa consulta?")) return;
    await fetch(`/api/admin/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelado" }),
    });
    await load();
  }

  async function setTipo(a: Appointment, tipo: string) {
    const res = await fetch(`/api/admin/appointments/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipoConsulta: tipo }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Falha ao salvar o tipo de consulta");
      return;
    }
    setAppointments((prev) => prev.map((x) => (x.id === a.id ? { ...x, tipo_consulta: tipo } : x)));
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir essa consulta do histórico? Essa ação não pode ser desfeita.")) return;
    const res = await fetch(`/api/admin/appointments/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error);
      return;
    }
    await load();
  }

  function toDateInputValue(iso: string) {
    // scheduled_at é gravado ao meio-dia UTC daquele dia, então basta
    // olhar a data em UTC (evita o fuso local "empurrar" pro dia anterior).
    return iso.slice(0, 10);
  }

  function startEdit(a: Appointment) {
    setEditingId(a.id);
    setEditForm({ doctorId: a.doctors?.id ?? "", scheduledDate: toDateInputValue(a.scheduled_at), tipoConsulta: a.tipo_consulta ?? "" });
  }

  async function saveEdit(id: string) {
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: editForm.doctorId,
          scheduledDate: editForm.scheduledDate,
          ...(editForm.tipoConsulta ? { tipoConsulta: editForm.tipoConsulta } : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }
      setEditingId(null);
      await load();
    } finally {
      setEditSaving(false);
    }
  }

  function copyLink(appointment: Appointment) {
    const url = `${window.location.origin}/paciente/${appointment.access_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(appointment.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const doctorsForSpecialty = doctors.filter(
    (d) => !form.specialtyId || d.specialty_id === form.specialtyId
  );

  // Some quem já tem consulta marcada nessa especialidade/data da lista
  // (a menos que já esteja selecionado, pra não sumir o valor escolhido).
  const patientsForSelection = patients.filter(
    (p) => p.id === form.patientId || !scheduledPatientIds.has(p.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-teal-dark bg-brand-teal/10 px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-brand-navy">Link fixo da cabine de atendimento</p>
          <p className="text-[11px] text-zinc-500">
            Deixe aberto sempre no computador da cabine — é o mesmo link pra qualquer médico/paciente.
          </p>
        </div>
        <button
          type="button"
          onClick={copyBoothLink}
          className="shrink-0 rounded-md border border-brand-teal-dark bg-white px-3 py-1.5 text-xs font-medium text-brand-teal-dark hover:bg-brand-teal/10"
        >
          {boothCopied ? "Copiado!" : "Copiar link /atendimento"}
        </button>
      </div>

      <form onSubmit={handleCreate} className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2">
        <label className="text-xs sm:col-span-2">
          <span className="mb-1 block font-medium text-zinc-600">Paciente</span>
          <select
            required
            value={form.patientId}
            onChange={(e) => setForm((f) => ({ ...f, patientId: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          >
            <option value="">Selecione...</option>
            {patientsForSelection.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
          {form.specialtyId && form.scheduledDate && patientsForSelection.length < patients.length && (
            <span className="mt-1 block text-[11px] text-zinc-400">
              Pacientes já agendados nessa especialidade/data não aparecem na lista.
            </span>
          )}
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Especialidade</span>
          <select
            required
            value={form.specialtyId}
            onChange={(e) => setForm((f) => ({ ...f, specialtyId: e.target.value, doctorId: "" }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          >
            <option value="">Selecione...</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Médico</span>
          <select
            value={form.doctorId}
            onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          >
            <option value="">A definir</option>
            {doctorsForSpecialty.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="mb-1 block font-medium text-zinc-600">Data</span>
          <input
            required
            type="date"
            value={form.scheduledDate}
            onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
          <span className="mt-1 block text-[11px] text-zinc-400">
            O atendimento é por ordem de chegada — não é preciso marcar horário.
          </span>
        </label>
        <div className="text-xs sm:col-span-2">
          <span className="mb-1 block font-medium text-zinc-600">Tipo de consulta</span>
          <TipoConsultaChoice value={form.tipoConsulta} onChange={(v) => setForm((f) => ({ ...f, tipoConsulta: v }))} />
        </div>
        <div className="sm:col-span-2">
          <button
            disabled={saving}
            className="rounded-md bg-brand-navy px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Agendar consulta
          </button>
        </div>
      </form>

      <ul className="space-y-2">
        {appointments.map((a) =>
          editingId === a.id ? (
            <li
              key={a.id}
              className="grid gap-3 rounded-md border border-brand-teal-dark bg-white p-4 text-sm sm:grid-cols-2"
            >
              <label className="text-xs">
                <span className="mb-1 block font-medium text-zinc-600">Médico</span>
                <select
                  value={editForm.doctorId}
                  onChange={(e) => setEditForm((f) => ({ ...f, doctorId: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                >
                  <option value="">A definir</option>
                  {doctors
                    .filter((d) => !a.specialties?.id || d.specialty_id === a.specialties.id)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-zinc-600">Data</span>
                <input
                  type="date"
                  value={editForm.scheduledDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                />
              </label>
              <div className="text-xs sm:col-span-2">
                <span className="mb-1 block font-medium text-zinc-600">Tipo de consulta</span>
                <TipoConsultaChoice
                  value={editForm.tipoConsulta}
                  onChange={(v) => setEditForm((f) => ({ ...f, tipoConsulta: v }))}
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <button
                  onClick={() => saveEdit(a.id)}
                  disabled={editSaving}
                  className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
              </div>
            </li>
          ) : (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-zinc-800">{a.patients?.full_name}</p>
                <p className="text-xs text-zinc-500">
                  {new Date(a.scheduled_at).toLocaleDateString("pt-BR", {
                    timeZone: "UTC",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                  {a.specialties?.name ? ` · ${a.specialties.name}` : ""}
                  {a.doctors?.name ? ` · ${a.doctors.name}` : " · sem médico definido"}
                  {a.queue_position != null ? ` · fila: #${a.queue_position}` : ""}
                </p>
                <div className="mt-1">
                  {a.tipo_consulta ? (
                    <button
                      type="button"
                      title="Clique para trocar entre rotina e retorno"
                      onClick={() => setTipo(a, a.tipo_consulta === "rotina" ? "retorno" : "rotina")}
                    >
                      <TipoConsultaBadge tipo={a.tipo_consulta} />
                    </button>
                  ) : (
                    a.status !== "cancelado" && (
                      <select
                        value=""
                        onChange={(e) => e.target.value && setTipo(a, e.target.value)}
                        className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 outline-none"
                      >
                        <option value="">Primeiro atendimento ou retorno?</option>
                        <option value="rotina">Rotina (primeiro atendimento)</option>
                        <option value="retorno">Retorno</option>
                      </select>
                    )
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                  {STATUS_LABELS[a.status] ?? a.status}
                </span>
                <button
                  onClick={() => copyLink(a)}
                  className="rounded-md border border-zinc-300 px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  {copiedId === a.id ? "Copiado!" : "Copiar link do paciente"}
                </button>
                {a.status !== "cancelado" && a.status !== "concluido" && (
                  <>
                    <button
                      onClick={() => startEdit(a)}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleCancel(a.id)}
                      className="rounded-md border border-red-200 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50"
                    >
                      Cancelar
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDelete(a.id)}
                  className="rounded-md border border-red-200 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50"
                >
                  Excluir
                </button>
              </div>
            </li>
          )
        )}
        {appointments.length === 0 && (
          <p className="text-xs text-zinc-400">Nenhuma consulta agendada.</p>
        )}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------
// Equipe (admin / atendente)
// ------------------------------------------------------------
const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  atendente: "Atendente",
};

function StaffTab() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "atendente" });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "atendente", password: "" });
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/staff");
    if (res.ok) setStaff((await res.json()).staff);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }
      setForm({ name: "", email: "", password: "", role: "atendente" });
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(member: StaffMember) {
    await fetch(`/api/admin/staff/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !member.active }),
    });
    await load();
  }

  function startEdit(m: StaffMember) {
    setEditingId(m.id);
    setEditForm({ name: m.name, email: m.email, role: m.role, password: "" });
  }

  async function handleDelete(m: StaffMember) {
    if (!confirm(`Excluir "${m.name}" da equipe? Essa ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/admin/staff/${m.id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error);
      return;
    }
    await load();
  }

  async function saveEdit(id: string) {
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
      };
      if (editForm.password) body.password = editForm.password;
      const res = await fetch(`/api/admin/staff/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }
      setEditingId(null);
      await load();
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleCreate} className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2">
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Nome</span>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">E-mail (login)</span>
          <input
            required
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Senha provisória</span>
          <input
            required
            type="text"
            minLength={6}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
            placeholder="mín. 6 caracteres"
          />
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Papel</span>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          >
            <option value="atendente">Atendente</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <div className="sm:col-span-2">
          <button
            disabled={saving}
            className="rounded-md bg-brand-navy px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Cadastrar
          </button>
        </div>
      </form>

      <ul className="space-y-2">
        {staff.map((m) =>
          editingId === m.id ? (
            <li
              key={m.id}
              className="grid gap-3 rounded-md border border-brand-teal-dark bg-white p-4 text-sm sm:grid-cols-2"
            >
              <label className="text-xs">
                <span className="mb-1 block font-medium text-zinc-600">Nome</span>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-zinc-600">E-mail (login)</span>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                />
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-zinc-600">Papel</span>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                >
                  <option value="atendente">Atendente</option>
                  <option value="admin">Administrador</option>
                </select>
              </label>
              <label className="text-xs">
                <span className="mb-1 block font-medium text-zinc-600">Nova senha (opcional)</span>
                <input
                  type="text"
                  minLength={6}
                  value={editForm.password}
                  onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                  placeholder="deixe em branco pra manter"
                />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <button
                  onClick={() => saveEdit(m.id)}
                  disabled={editSaving}
                  className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Cancelar
                </button>
              </div>
            </li>
          ) : (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm"
            >
              <div>
                <p className="font-medium text-zinc-800">{m.name}</p>
                <p className="text-xs text-zinc-500">
                  {m.email} · {ROLE_LABELS[m.role] ?? m.role}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => startEdit(m)}
                  className="rounded-md border border-zinc-300 px-2.5 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  Editar
                </button>
                <button
                  onClick={() => handleDelete(m)}
                  className="rounded-md border border-red-200 px-2.5 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50"
                >
                  Excluir
                </button>
                <button
                  onClick={() => toggleActive(m)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                    m.active ? "bg-brand-teal/15 text-brand-teal-dark" : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {m.active ? "Ativo" : "Inativo"}
                </button>
              </div>
            </li>
          )
        )}
        {staff.length === 0 && (
          <p className="text-xs text-zinc-400">Nenhum membro da equipe cadastrado ainda.</p>
        )}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------
// Captação de médicos (formulário público de cadastro)
// ------------------------------------------------------------
const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  novo: "Novo",
  em_avaliacao: "Em avaliação",
  aprovado: "Aprovado",
  recusado: "Recusado",
};

const APPLICATION_STATUS_STYLES: Record<ApplicationStatus, string> = {
  novo: "bg-sky-50 text-sky-700",
  em_avaliacao: "bg-amber-50 text-amber-700",
  aprovado: "bg-emerald-50 text-emerald-700",
  recusado: "bg-red-50 text-red-700",
};

const WEEKDAY_LABELS: Record<string, string> = {
  seg: "Seg",
  ter: "Ter",
  qua: "Qua",
  qui: "Qui",
  sex: "Sex",
  sab: "Sáb",
  dom: "Dom",
};

function formatApplicationDays(app: DoctorApplication) {
  const days = app.available_days.map((d) => WEEKDAY_LABELS[d] ?? d).join(", ");
  const shifts = app.available_shifts
    .map((s) => SHIFTS.find((x) => x.key === s)?.label ?? s)
    .join("/");
  if (!days && !shifts) return "—";
  return [days, shifts].filter(Boolean).join(" · ");
}

function formatPrice(value: number | null) {
  if (value === null) return "—";
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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

function CaptacaoTab() {
  const [applications, setApplications] = useState<DoctorApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [city, setCity] = useState("");
  const [shift, setShift] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<DoctorApplication | null>(null);

  const [weekAgo, setWeekAgo] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setWeekAgo(Date.now() - 7 * 24 * 60 * 60 * 1000);
    try {
      const res = await fetch("/api/admin/doctor-applications");
      if (res.ok) setApplications((await res.json()).applications);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(load, 0);
    return () => clearTimeout(timeout);
  }, [load]);

  async function updateStatus(app: DoctorApplication, next: ApplicationStatus) {
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

  const cities = Array.from(new Set(applications.map((a) => a.city))).sort();

  const filtered = applications.filter((a) => {
    if (search) {
      const q = search.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !a.crm.toLowerCase().includes(q)) return false;
    }
    if (specialty && a.specialty !== specialty) return false;
    if (city && a.city !== city) return false;
    if (shift && !a.available_shifts.includes(shift)) return false;
    if (status && a.status !== status) return false;
    return true;
  });

  const totals = {
    total: applications.length,
    novaSemana: applications.filter((a) => new Date(a.created_at).getTime() >= weekAgo).length,
    emAvaliacao: applications.filter((a) => a.status === "em_avaliacao").length,
    aprovados: applications.filter((a) => a.status === "aprovado").length,
  };
  const taxaAprovacao = totals.total > 0 ? Math.round((totals.aprovados / totals.total) * 100) : 0;

  function clearFilters() {
    setSearch("");
    setSpecialty("");
    setCity("");
    setShift("");
    setStatus("");
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500">Total cadastrados</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{totals.total}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500">Novos esta semana</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{totals.novaSemana}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500">Em avaliação</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{totals.emAvaliacao}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <p className="text-xs font-medium text-zinc-500">Aprovados · taxa</p>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {totals.aprovados}{" "}
            <span className="text-sm font-medium text-brand-teal-dark">({taxaAprovacao}%)</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou CRM"
          className="w-48 rounded-md border border-zinc-300 px-3 py-1.5 text-xs outline-none focus:border-brand-teal-dark"
        />
        <select
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand-teal-dark"
        >
          <option value="">Especialidade: todas</option>
          {SPECIALTIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand-teal-dark"
        >
          <option value="">Cidade: todas</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={shift}
          onChange={(e) => setShift(e.target.value)}
          className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand-teal-dark"
        >
          <option value="">Disponibilidade: qualquer</option>
          {SHIFTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand-teal-dark"
        >
          <option value="">Status: todos</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {APPLICATION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={clearFilters}
          className="text-xs font-medium text-brand-teal-dark hover:underline"
        >
          Limpar filtros
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
              <th className="px-4 py-3">Médico</th>
              <th className="px-4 py-3">Especialidade</th>
              <th className="px-4 py-3">Cidade</th>
              <th className="px-4 py-3">Disponibilidade</th>
              <th className="px-4 py-3">Valor/consulta</th>
              <th className="px-4 py-3">Cadastrado em</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-b border-zinc-100 last:border-0">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setSelected(a)}
                    className="flex items-center gap-2.5 text-left"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-500">
                      {initials(a.name)}
                    </span>
                    <span>
                      <span className="block font-medium text-zinc-800">{a.name}</span>
                      <span className="block text-xs text-zinc-400">
                        CRM {a.crm}-{a.crm_uf}
                      </span>
                    </span>
                  </button>
                </td>
                <td className="px-4 py-3 text-zinc-600">{a.specialty}</td>
                <td className="px-4 py-3 text-zinc-600">
                  {a.city} - {a.state}
                </td>
                <td className="px-4 py-3 text-zinc-600">{formatApplicationDays(a)}</td>
                <td className="px-4 py-3 text-zinc-600">{formatPrice(a.consult_price)}</td>
                <td className="px-4 py-3 text-zinc-500">
                  {new Date(a.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${APPLICATION_STATUS_STYLES[a.status]}`}
                  >
                    {APPLICATION_STATUS_LABELS[a.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setSelected(a)}
                      title="Ver perfil"
                      className="rounded-md border border-zinc-300 p-1.5 text-zinc-600 hover:bg-zinc-50"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-3.5 w-3.5">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    <button
                      onClick={() => updateStatus(a, "aprovado")}
                      title="Aprovar"
                      className="rounded-md border border-emerald-200 p-1.5 text-emerald-600 hover:bg-emerald-50"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <button
                      onClick={() => updateStatus(a, "recusado")}
                      title="Recusar"
                      className="rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <p className="p-6 text-center text-xs text-zinc-400">Nenhuma candidatura encontrada.</p>
        )}
        {loading && <p className="p-6 text-center text-xs text-zinc-400">Carregando...</p>}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              {selected.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <a href={selected.photo_url} target="_blank" rel="noopener noreferrer" title="Ver foto em tamanho maior"><img src={selected.photo_url} alt={selected.name} className="h-14 w-14 shrink-0 cursor-pointer rounded-full object-cover transition-opacity hover:opacity-80" /></a>
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-500">
                  {initials(selected.name)}
                </span>
              )}
              <div className="flex-1">
                <h3 className="text-base font-semibold text-zinc-900">{selected.name}</h3>
                <p className="text-xs text-zinc-500">
                  CRM {selected.crm}-{selected.crm_uf} · {selected.specialty}
                  {selected.experience_years ? ` · ${selected.experience_years} anos de experiência` : ""}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${APPLICATION_STATUS_STYLES[selected.status]}`}
              >
                {APPLICATION_STATUS_LABELS[selected.status]}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              <div>
                <dt className="font-medium text-zinc-400">E-mail</dt>
                <dd className="text-zinc-700">{selected.email}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-400">WhatsApp</dt>
                <dd className="text-zinc-700">{selected.whatsapp}</dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-400">Cidade</dt>
                <dd className="text-zinc-700">
                  {selected.city} - {selected.state}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-zinc-400">Valor pretendido</dt>
                <dd className="text-zinc-700">{formatPrice(selected.consult_price)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="font-medium text-zinc-400">Disponibilidade</dt>
                <dd className="text-zinc-700">{formatApplicationDays(selected)}</dd>
              </div>
              {selected.presentation && (
                <div className="col-span-2">
                  <dt className="font-medium text-zinc-400">Apresentação</dt>
                  <dd className="text-zinc-700">{selected.presentation}</dd>
                </div>
              )}
            </dl>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {(["novo", "em_avaliacao", "aprovado", "recusado"] as ApplicationStatus[])
                .filter((s) => s !== selected.status)
                .map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(selected, s)}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                  >
                    Marcar como {APPLICATION_STATUS_LABELS[s]}
                  </button>
                ))}
              <button
                onClick={() => setSelected(null)}
                className="rounded-md bg-brand-navy px-3 py-1.5 text-xs font-medium text-white"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
