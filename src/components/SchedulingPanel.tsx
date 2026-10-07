"use client";

import { useCallback, useEffect, useState } from "react";
import LogoutButton from "./LogoutButton";
import TipoConsultaBadge, { TipoConsultaChoice } from "./TipoConsultaBadge";

/**
 * Painel da equipe de Agendamento: só cadastra paciente (sem duplicar)
 * e agenda consulta. Não exclui, não vê histórico, prontuário nem valores.
 */

interface PatientLite {
  id: string;
  full_name: string;
  cpf: string | null;
  phone?: string | null;
  birth_date?: string | null;
}
interface Specialty {
  id: string;
  name: string;
}
interface Doctor {
  id: string;
  name: string;
  specialty_id: string | null;
  active: boolean;
}
interface Appt {
  id: string;
  scheduled_at: string;
  status: string;
  tipo_consulta?: string | null;
  patients: { id: string; full_name: string } | null;
  doctors: { id: string; name: string } | null;
  specialties: { id: string; name: string } | null;
}

type Tab = "cadastro" | "agenda";

const STATUS_LABEL: Record<string, string> = {
  agendado: "Agendado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  faltou: "Faltou",
};

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-teal-dark";
const labelCls = "mb-1 mt-3 block text-xs font-medium text-zinc-600";

function maskCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function dayLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
}
function todayKey() {
  const d = new Date(Date.now() - 3 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

export default function SchedulingPanel({ staffName }: { staffName: string }) {
  const [tab, setTab] = useState<Tab>("cadastro");
  const [preselect, setPreselect] = useState<PatientLite | null>(null);

  function goSchedule(p: PatientLite) {
    setPreselect(p);
    setTab("agenda");
  }

  const navBtn = (key: Tab, label: string) => (
    <button
      onClick={() => setTab(key)}
      className={`w-full rounded-xl px-3 py-2.5 text-left text-sm font-medium ${
        tab === key ? "bg-brand-navy text-white" : "text-zinc-700 hover:bg-zinc-100"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#f7f6f3] md:flex-row">
      <aside className="border-b border-zinc-200 bg-white p-4 md:w-56 md:border-b-0 md:border-r">
        <div className="text-xl font-extrabold text-brand-navy">Facilitta</div>
        <div className="mb-4 text-[11px] text-zinc-500">Equipe de Agendamento</div>
        <nav className="flex gap-2 md:flex-col">
          {navBtn("cadastro", "Cadastro de pacientes")}
          {navBtn("agenda", "Agendamento")}
        </nav>
        <div className="mt-4 md:mt-8">
          <LogoutButton redirectTo="/equipe/login" />
        </div>
      </aside>
      <main className="flex-1">
        <header className="bg-brand-navy px-6 py-4 text-white">
          <div className="text-lg font-bold">{tab === "cadastro" ? "Cadastro de pacientes" : "Agendamento"}</div>
          <div className="text-xs opacity-70">Olá, {staffName} (Agendamento)</div>
        </header>
        <div className="mx-auto max-w-3xl p-4 md:p-6">
          {tab === "cadastro" ? (
            <CadastroTab onSchedule={goSchedule} />
          ) : (
            <AgendaTab preselect={preselect} onUsedPreselect={() => setPreselect(null)} />
          )}
        </div>
      </main>
    </div>
  );
}

// ------------------------------------------------------------
// Cadastro
// ------------------------------------------------------------
function CadastroTab({ onSchedule }: { onSchedule: (p: PatientLite) => void }) {
  const [cpf, setCpf] = useState("");
  const [existing, setExisting] = useState<PatientLite | null>(null);
  const [checking, setChecking] = useState(false);
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<PatientLite | null>(null);

  const digits = cpf.replace(/\D/g, "");
  const cpfReady = digits.length === 11;

  useEffect(() => {
    if (!cpfReady) return;
    let cancelled = false;
    fetch(`/api/admin/patients?cpf=${digits}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setExisting(d.matches?.[0] ?? null);
        setChecking(false);
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [digits, cpfReady]);

  function onCpfChange(v: string) {
    const masked = maskCpf(v);
    setCpf(masked);
    setCreated(null);
    setError("");
    if (masked.replace(/\D/g, "").length === 11) setChecking(true);
    else {
      setExisting(null);
      setChecking(false);
    }
  }

  async function save() {
    setError("");
    if (!cpfReady) return setError("Informe o CPF completo (11 números).");
    if (!fullName.trim()) return setError("Informe o nome completo.");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          cpf,
          birthDate: birthDate || null,
          phone: phone || null,
          email: email || null,
          city: city || null,
          state: state || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.existing) {
        setExisting(data.existing);
        return;
      }
      if (!res.ok) return setError(data.error ?? "Não foi possível cadastrar.");
      setCreated(data.patient);
      setCpf("");
      setFullName("");
      setBirthDate("");
      setPhone("");
      setEmail("");
      setCity("");
      setState("");
      setExisting(null);
    } finally {
      setSaving(false);
    }
  }

  const blocked = !!existing;

  return (
    <div>
      {created && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <b>Paciente cadastrado:</b> {created.full_name}.
          <div>
            <button
              onClick={() => onSchedule(created)}
              className="mt-2 rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white"
            >
              Agendar consulta para este paciente →
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-brand-navy">Novo paciente</h2>
        <label className={labelCls}>CPF (digite primeiro)</label>
        <input
          className={`${inputCls} max-w-[240px]`}
          inputMode="numeric"
          placeholder="000.000.000-00"
          value={cpf}
          onChange={(e) => onCpfChange(e.target.value)}
        />
        {checking && <p className="mt-1 text-xs text-zinc-500">Conferindo se já existe cadastro…</p>}
        {cpfReady && !checking && !existing && (
          <p className="mt-1 text-xs text-brand-teal-dark">CPF livre — pode preencher o cadastro.</p>
        )}

        {existing && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <b>Paciente já cadastrado com esse CPF.</b>
            <div className="mt-1">
              {existing.full_name}
              {existing.phone ? ` · ${existing.phone}` : ""}
            </div>
            <div className="mt-1">Não é preciso cadastrar de novo — vá para o Agendamento.</div>
            <button
              onClick={() => onSchedule(existing)}
              className="mt-3 rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white"
            >
              Ir para Agendamento →
            </button>
          </div>
        )}

        <fieldset disabled={blocked || !cpfReady} className={blocked || !cpfReady ? "opacity-50" : ""}>
          <label className={labelCls}>Nome completo</label>
          <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <div className="grid gap-x-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Data de nascimento</label>
              <input type="date" className={inputCls} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Celular</label>
              <input
                className={inputCls}
                inputMode="numeric"
                placeholder="(11) 90000-0000"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
              />
            </div>
          </div>
          <label className={labelCls}>E-mail (opcional)</label>
          <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="grid gap-x-4 sm:grid-cols-[1fr_90px]">
            <div>
              <label className={labelCls}>Cidade</label>
              <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>UF</label>
              <input
                className={inputCls}
                maxLength={2}
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase())}
              />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <button
            onClick={save}
            disabled={saving}
            className="mt-4 rounded-lg bg-brand-teal-dark px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Salvando…" : "Cadastrar paciente"}
          </button>
        </fieldset>
        {!cpfReady && (
          <p className="mt-3 text-xs text-zinc-500">O formulário libera depois de digitar um CPF que ainda não existe.</p>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Agendamento
// ------------------------------------------------------------
function AgendaTab({ preselect, onUsedPreselect }: { preselect: PatientLite | null; onUsedPreselect: () => void }) {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PatientLite[]>([]);
  const [patient, setPatient] = useState<PatientLite | null>(preselect);
  const [specialtyId, setSpecialtyId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(todayKey());
  const [tipo, setTipo] = useState("rotina");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [confirm, setConfirm] = useState<Appt | null>(null);

  useEffect(() => {
    if (preselect) onUsedPreselect();
  }, [preselect, onUsedPreselect]);

  const loadAppts = useCallback(async () => {
    const from = new Date(Date.now() - 3 * 86400000).toISOString();
    const res = await fetch(`/api/admin/appointments?from=${encodeURIComponent(from)}`);
    const d = await res.json().catch(() => ({}));
    setAppts(((d.appointments ?? []) as Appt[]).slice().reverse());
  }, []);

  useEffect(() => {
    fetch("/api/admin/specialties")
      .then((r) => r.json())
      .then((d) => setSpecialties(d.specialties ?? []));
    fetch("/api/admin/doctors")
      .then((r) => r.json())
      .then((d) => setDoctors((d.doctors ?? []).filter((x: Doctor) => x.active)));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAppts();
  }, [loadAppts]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) return;
    const t = setTimeout(() => {
      fetch(`/api/admin/patients?q=${encodeURIComponent(term)}`)
        .then((r) => r.json())
        .then((d) => setResults((d.patients ?? []).slice(0, 8)));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const docsOfSpec = doctors.filter((d) => !specialtyId || d.specialty_id === specialtyId);

  async function schedule() {
    setError("");
    setOk("");
    if (!patient) return setError("Escolha o paciente.");
    if (!specialtyId) return setError("Escolha a especialidade.");
    if (!date) return setError("Escolha a data.");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          doctorId: doctorId || null,
          specialtyId,
          scheduledDate: date,
          tipoConsulta: tipo,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? "Não foi possível agendar.");
      setOk(`Consulta agendada para ${patient.full_name} em ${date.split("-").reverse().join("/")}.`);
      setPatient(null);
      setQ("");
      setResults([]);
      await loadAppts();
    } finally {
      setSaving(false);
    }
  }

  async function cancelAppt(a: Appt) {
    await fetch(`/api/admin/appointments/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelado" }),
    });
    setConfirm(null);
    await loadAppts();
  }

  return (
    <div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-brand-navy">Agendar consulta</h2>

        <label className={labelCls}>Paciente (nome ou CPF)</label>
        {patient ? (
          <div className="flex items-center justify-between rounded-lg border border-brand-teal-dark bg-brand-teal/10 px-3 py-2 text-sm">
            <span>
              {patient.full_name}
              {patient.cpf ? ` — ${patient.cpf}` : ""}
            </span>
            <button onClick={() => setPatient(null)} className="text-xs text-zinc-600 underline">
              trocar
            </button>
          </div>
        ) : (
          <>
            <input
              className={inputCls}
              placeholder="Digite ao menos 3 letras ou o CPF"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q.trim().length >= 3 && (
              <div className="mt-1 divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
                {results.length === 0 && (
                  <p className="px-3 py-2 text-xs text-zinc-500">
                    Ninguém encontrado. Cadastre o paciente na aba &quot;Cadastro de pacientes&quot;.
                  </p>
                )}
                {results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPatient(p)}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                  >
                    {p.full_name} <span className="text-xs text-zinc-500">{p.cpf ?? ""}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <div className="grid gap-x-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Especialidade</label>
            <select
              className={inputCls}
              value={specialtyId}
              onChange={(e) => {
                setSpecialtyId(e.target.value);
                setDoctorId("");
              }}
            >
              <option value="">Selecione…</option>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Médico (opcional)</label>
            <select className={inputCls} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">Qualquer médico da especialidade</option>
              {docsOfSpec.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Data</label>
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Tipo</label>
            <TipoConsultaChoice value={tipo} onChange={setTipo} />
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-500">O atendimento é por ordem de chegada no dia escolhido (sem horário marcado).</p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {ok && <p className="mt-3 text-sm text-emerald-700">{ok}</p>}
        <button
          onClick={schedule}
          disabled={saving}
          className="mt-4 rounded-lg bg-brand-teal-dark px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Agendando…" : "Agendar"}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5">
        <h2 className="text-base font-semibold text-brand-navy">Agendamentos recentes e próximos</h2>
        {appts.length === 0 && <p className="mt-2 text-sm text-zinc-500">Nenhum agendamento.</p>}
        <div className="mt-2 divide-y divide-zinc-100">
          {appts.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <div className="font-medium text-zinc-900">
                  {a.patients?.full_name ?? "—"} <TipoConsultaBadge tipo={a.tipo_consulta} />
                </div>
                <div className="text-xs text-zinc-500">
                  {a.specialties?.name ?? "—"}
                  {a.doctors ? ` · ${a.doctors.name}` : ""} · {dayLabel(a.scheduled_at)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700">
                  {STATUS_LABEL[a.status] ?? a.status}
                </span>
                {a.status === "agendado" && (
                  <button onClick={() => setConfirm(a)} className="text-xs text-red-600 underline">
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <h3 className="font-semibold text-brand-navy">Cancelar agendamento?</h3>
            <p className="mt-2 text-sm text-zinc-600">
              {confirm.patients?.full_name} — {confirm.specialties?.name} em {dayLabel(confirm.scheduled_at)}.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setConfirm(null)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">
                Voltar
              </button>
              <button
                onClick={() => cancelAppt(confirm)}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white"
              >
                Sim, cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
