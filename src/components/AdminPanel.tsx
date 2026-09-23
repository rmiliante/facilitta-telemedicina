"use client";

import { useEffect, useState, useCallback } from "react";

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
  patients: { id: string; full_name: string } | null;
  doctors: { id: string; name: string } | null;
  specialties: { id: string; name: string } | null;
}

type Tab = "agenda" | "pacientes" | "medicos" | "especialidades";

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  faltou: "Faltou",
};

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("agenda");

  return (
    <div className="min-h-screen bg-brand-bg">
      <div className="border-b border-brand-navy bg-brand-navy px-4 py-3 sm:px-6">
        <h1 className="text-sm font-semibold text-white">
          Administração — Facilitta Telemedicina
        </h1>
      </div>

      <div className="border-b border-zinc-200 bg-white px-4 sm:px-6">
        <div className="flex gap-1 overflow-x-auto py-2">
          {(
            [
              ["agenda", "Agenda"],
              ["pacientes", "Pacientes"],
              ["medicos", "Médicos"],
              ["especialidades", "Especialidades"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
                tab === key
                  ? "bg-brand-teal/15 text-brand-teal-dark"
                  : "text-zinc-500 hover:bg-zinc-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {tab === "especialidades" && <SpecialtiesTab />}
        {tab === "medicos" && <DoctorsTab />}
        {tab === "pacientes" && <PatientsTab />}
        {tab === "agenda" && <AgendaTab />}
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
        {specialties.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm"
          >
            <span className="font-medium text-zinc-800">{s.name}</span>
            <span className="text-xs text-zinc-500">{s.monthly_quota} consultas/mês</span>
          </li>
        ))}
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
function DoctorsTab() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", specialtyId: "" });
  const [saving, setSaving] = useState(false);

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
      setForm({ name: "", email: "", password: "", specialtyId: "" });
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
        {doctors.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm"
          >
            <div>
              <p className="font-medium text-zinc-800">{d.name}</p>
              <p className="text-xs text-zinc-500">
                {d.email} {d.specialties?.name ? `· ${d.specialties.name}` : ""}
              </p>
            </div>
            <button
              onClick={() => toggleActive(d)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${
                d.active ? "bg-brand-teal/15 text-brand-teal-dark" : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {d.active ? "Ativo" : "Inativo"}
            </button>
          </li>
        ))}
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

  const load = useCallback(async (q?: string) => {
    const res = await fetch(`/api/admin/patients${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    if (res.ok) setPatients((await res.json()).patients);
  }, []);

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
        {patients.map((p) => (
          <li key={p.id} className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm">
            <p className="font-medium text-zinc-800">{p.full_name}</p>
            <p className="text-xs text-zinc-500">
              {p.cpf ? `CPF ${p.cpf} · ` : ""}
              {p.phone ?? p.email ?? ""}
              {p.city ? ` · ${p.city}${p.state ? `/${p.state}` : ""}` : ""}
            </p>
          </li>
        ))}
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
  const [form, setForm] = useState({ patientId: "", doctorId: "", specialtyId: "", scheduledAt: "" });
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
      setForm({ patientId: "", doctorId: "", specialtyId: "", scheduledAt: "" });
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

  return (
    <div className="space-y-6">
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
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
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
          <span className="mb-1 block font-medium text-zinc-600">Data e hora</span>
          <input
            required
            type="datetime-local"
            value={form.scheduledAt}
            onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
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
        {appointments.map((a) => (
          <li
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm"
          >
            <div className="min-w-0">
              <p className="font-medium text-zinc-800">{a.patients?.full_name}</p>
              <p className="text-xs text-zinc-500">
                {new Date(a.scheduled_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {a.specialties?.name ? ` · ${a.specialties.name}` : ""}
                {a.doctors?.name ? ` · ${a.doctors.name}` : " · sem médico definido"}
              </p>
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
                <button
                  onClick={() => handleCancel(a.id)}
                  className="rounded-md border border-red-200 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          </li>
        ))}
        {appointments.length === 0 && (
          <p className="text-xs text-zinc-400">Nenhuma consulta agendada.</p>
        )}
      </ul>
    </div>
  );
}
