"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import PacientesDashboard from "./PacientesDashboard";

type Sub = "consultas" | "pacientes" | "captacao" | "medicos";

const SUBS: { key: Sub; label: string }[] = [
  { key: "consultas", label: "Consultas" },
  { key: "pacientes", label: "Pacientes" },
  { key: "captacao", label: "Captação" },
  { key: "medicos", label: "Médicos" },
];

/** Botões no topo do Dashboard: Consultas (o painel que já existia), Captação e Médicos ativos. */
export default function DashboardTabs({ consultas }: { consultas: ReactNode }) {
  const [sub, setSub] = useState<Sub>("consultas");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {SUBS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSub(s.key)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
              sub === s.key
                ? "border-brand-navy bg-brand-navy text-white"
                : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sub === "consultas" && consultas}
      {sub === "pacientes" && <PacientesDashboard />}
      {sub === "captacao" && <CaptacaoDashboard />}
      {sub === "medicos" && <MedicosDashboard />}
    </div>
  );
}

function useStats<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        setError(true);
        return;
      }
      setData((await res.json()) as T);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);
  return { data, loading, error, load };
}

function State({ loading, error, onRetry }: { loading: boolean; error: boolean; onRetry: () => void }) {
  if (loading) return <p className="text-xs text-zinc-400">Carregando...</p>;
  if (error)
    return (
      <div className="space-y-2">
        <p className="text-xs text-red-600">Falha ao carregar os dados.</p>
        <button onClick={onRetry} className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
          Tentar de novo
        </button>
      </div>
    );
  return null;
}

function Kpi({ label, value, tone }: { label: string; value: ReactNode; tone?: "teal" | "amber" }) {
  const color = tone === "teal" ? "text-brand-teal-dark" : tone === "amber" ? "text-amber-600" : "text-brand-navy";
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Card({ title, children, note }: { title: string; children: ReactNode; note?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{title}</h3>
      {children}
      {note && <p className="mt-2 text-[11px] text-zinc-500">{note}</p>}
    </div>
  );
}

function Bars({ items, color = "bg-brand-teal" }: { items: { name: string; count: number }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  if (items.length === 0) return <p className="text-xs text-zinc-400">Sem dados ainda.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-2 text-xs">
          <span className="w-32 shrink-0 truncate text-zinc-700" title={i.name}>
            {i.name}
          </span>
          <span className="h-2.5 flex-1 rounded-full bg-zinc-100">
            <span className={`block h-2.5 rounded-full ${color}`} style={{ width: `${Math.max(3, (i.count / max) * 100)}%` }} />
          </span>
          <span className="w-8 text-right text-zinc-500">{i.count}</span>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------
// Captação
// ------------------------------------------------------------
interface CaptacaoStats {
  total: number;
  novos30d: number;
  aprovados: number;
  taxaAprovacao: number;
  semResposta7d: number;
  byOrigin: { origin: "organico" | "pago"; count: number; approved: number; rate: number }[];
  byProfession: { name: string; count: number }[];
  funnel: { name: string; count: number }[];
  bySpecialty: { name: string; count: number }[];
  byState: { name: string; count: number }[];
  topCities: string[];
  experience: { name: string; count: number }[];
  byCollaboration: { name: string; count: number }[];
  weeks: { start: string; organico: number; pago: number }[];
}

function CaptacaoDashboard() {
  const { data, loading, error, load } = useStats<CaptacaoStats>("/api/admin/dashboard-captacao");
  if (!data) return <State loading={loading} error={error} onRetry={load} />;

  const org = data.byOrigin.find((o) => o.origin === "organico");
  const pago = data.byOrigin.find((o) => o.origin === "pago");
  const orgPct = data.total ? Math.round(((org?.count ?? 0) / data.total) * 100) : 0;
  const weekMax = Math.max(1, ...data.weeks.map((w) => w.organico + w.pago));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Candidatos (sem repetição)" value={data.total} />
        <Kpi label="Novos nos últimos 30 dias" value={data.novos30d} tone="teal" />
        <Kpi
          label="Aprovados · taxa"
          value={
            <>
              {data.aprovados} <span className="text-sm font-medium text-brand-teal-dark">({data.taxaAprovacao}%)</span>
            </>
          }
        />
        <Kpi label="Novos sem resposta há + de 7 dias" value={data.semResposta7d} tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Origem" note={`Aprovação: orgânico ${org?.rate ?? 0}% · pago ${pago?.rate ?? 0}%`}>
          <div className="flex items-center gap-4">
            <span
              className="relative h-24 w-24 shrink-0 rounded-full"
              style={{ background: `conic-gradient(#00e2c3 0 ${orgPct}%, #15004d ${orgPct}% 100%)` }}
            >
              <span className="absolute inset-[22px] rounded-full bg-white" />
            </span>
            <div className="space-y-1 text-xs text-zinc-700">
              <p>
                <span className="text-brand-teal-dark">●</span> Orgânico (site): <strong>{org?.count ?? 0}</strong>
              </p>
              <p>
                <span className="text-brand-navy">●</span> Tráfego pago: <strong>{pago?.count ?? 0}</strong>
              </p>
            </div>
          </div>
        </Card>
        <Card title="Profissão">
          <Bars items={data.byProfession} />
        </Card>
        <Card title="Funil" note={data.funnel.length ? "Cadastrados = aprovados que já viraram médico." : undefined}>
          <Bars items={data.funnel} color="bg-brand-navy" />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Especialidades">
          <Bars items={data.bySpecialty} />
        </Card>
        <Card title="Região (estado)" note={data.topCities.length ? `Principais cidades: ${data.topCities.join(", ")}` : undefined}>
          <Bars items={data.byState} />
        </Card>
        <Card title="Experiência" note="Lida dos comentários quando o candidato informa os anos.">
          <Bars items={data.experience} color="bg-amber-400" />
          <p className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Forma de colaboração</p>
          <Bars items={data.byCollaboration} color="bg-brand-navy" />
        </Card>
      </div>

      <Card title="Candidaturas por semana · orgânico x pago">
        <div className="flex h-28 items-end gap-2">
          {data.weeks.map((w) => {
            const total = w.organico + w.pago;
            return (
              <div key={w.start} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Semana de ${w.start}: ${w.organico} orgânico, ${w.pago} pago`}>
                <div className="flex w-full flex-col justify-end overflow-hidden rounded-t" style={{ height: `${(total / weekMax) * 100}%` }}>
                  <div className="bg-brand-navy" style={{ flex: w.pago }} />
                  <div className="bg-brand-teal" style={{ flex: w.organico }} />
                </div>
                <span className="text-[10px] text-zinc-400">{w.start.slice(8, 10)}/{w.start.slice(5, 7)}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 flex gap-4 text-[11px] text-zinc-500">
          <span><span className="text-brand-teal-dark">■</span> Orgânico</span>
          <span><span className="text-brand-navy">■</span> Pago</span>
        </p>
      </Card>
    </div>
  );
}

// ------------------------------------------------------------
// Médicos ativos
// ------------------------------------------------------------
interface MedicosStats {
  total: number;
  assinaturaAtiva: number;
  mediaConsultasMes: number;
  incompletos: number;
  bySpecialty: { name: string; count: number }[];
  byState: { name: string; count: number }[];
  byCertificate: { name: string; count: number }[];
  byOrigin: { name: string; count: number }[];
  doctors: {
    id: string;
    name: string;
    specialty: string;
    uf: string | null;
    experienceYears: number | null;
    months: number;
    consultas90d: number;
    certificate: string;
    signing: string;
  }[];
}

function tenure(months: number) {
  if (months < 1) return "menos de 1 mês";
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const y = Math.floor(months / 12);
  return `${y} ${y === 1 ? "ano" : "anos"}`;
}

function MedicosDashboard() {
  const { data, loading, error, load } = useStats<MedicosStats>("/api/admin/dashboard-medicos");
  if (!data) return <State loading={loading} error={error} onRetry={load} />;

  const badge = (s: string) =>
    s === "ativa" ? "bg-emerald-50 text-emerald-700" : s === "inativa" ? "bg-zinc-100 text-zinc-600" : "bg-amber-50 text-amber-700";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Médicos ativos" value={data.total} />
        <Kpi label="Assinatura ativa agora" value={data.assinaturaAtiva} tone="teal" />
        <Kpi label="Consultas por médico (média/mês, 90 dias)" value={data.mediaConsultasMes} />
        <Kpi label="Cadastros incompletos" value={data.incompletos} tone="amber" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Especialidades">
          <Bars items={data.bySpecialty} />
        </Card>
        <Card title="Região (UF do CRM)">
          <Bars items={data.byState} />
        </Card>
        <Card title="Certificado digital">
          <Bars items={data.byCertificate} color="bg-brand-navy" />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card title="Médicos · experiência, tempo de casa e produção">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="text-[10.5px] uppercase tracking-wide text-zinc-400">
                <tr>
                  <th className="pb-2 pr-3 font-semibold">Médico</th>
                  <th className="pb-2 pr-3 font-semibold">Esp.</th>
                  <th className="pb-2 pr-3 font-semibold">UF</th>
                  <th className="pb-2 pr-3 font-semibold">Exper.</th>
                  <th className="pb-2 pr-3 font-semibold">Na Facilitta</th>
                  <th className="pb-2 pr-3 font-semibold">Consultas (90d)</th>
                  <th className="pb-2 font-semibold">Assinatura</th>
                </tr>
              </thead>
              <tbody>
                {data.doctors.map((d) => (
                  <tr key={d.id} className="border-t border-zinc-100 text-zinc-700">
                    <td className="py-2 pr-3 font-medium text-brand-navy">{d.name}</td>
                    <td className="py-2 pr-3">{d.specialty}</td>
                    <td className="py-2 pr-3">{d.uf ?? "—"}</td>
                    <td className="py-2 pr-3">{d.experienceYears != null ? `${d.experienceYears} anos` : "—"}</td>
                    <td className="py-2 pr-3">{tenure(d.months)}</td>
                    <td className="py-2 pr-3">{d.consultas90d}</td>
                    <td className="py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${badge(d.signing)}`}>{d.signing}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Origem dos médicos ativos" note="Experiência vem da candidatura, quando informada.">
          <Bars items={data.byOrigin} color="bg-amber-400" />
        </Card>
      </div>
    </div>
  );
}
