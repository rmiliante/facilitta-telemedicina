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
  memed_email: string | null;
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

type Tab = "agenda" | "pacientes" | "medicos" | "especialidades" | "equipe";

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

const NAV_ITEMS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "agenda", label: "Agenda", icon: <IconCalendar /> },
  { key: "pacientes", label: "Pacientes", icon: <IconUsers /> },
  { key: "medicos", label: "Médicos", icon: <IconStethoscope /> },
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
        </ul>
      </div>
    </nav>
  );
}

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("agenda");
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
          <div className="mx-auto max-w-4xl">
            {tab === "especialidades" && <SpecialtiesTab />}
            {tab === "medicos" && <DoctorsTab />}
            {tab === "pacientes" && <PatientsTab />}
            {tab === "agenda" && <AgendaTab />}
            {tab === "equipe" && <StaffTab />}
          </div>
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
function DoctorsTab() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", specialtyId: "", memedEmail: "" });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", specialtyId: "", password: "", memedEmail: "" });
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
      setForm({ name: "", email: "", password: "", specialtyId: "", memedEmail: "" });
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
      memedEmail: d.memed_email ?? "",
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
        memedEmail: editForm.memedEmail,
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
        <label className="text-xs sm:col-span-2">
          <span className="mb-1 block font-medium text-zinc-600">E-mail de login na Memed (opcional)</span>
          <input
            type="email"
            value={form.memedEmail}
            onChange={(e) => setForm((f) => ({ ...f, memedEmail: e.target.value }))}
            placeholder="conta pessoal do médico na Memed, só como referência"
            className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
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
              <label className="text-xs sm:col-span-2">
                <span className="mb-1 block font-medium text-zinc-600">E-mail de login na Memed (opcional)</span>
                <input
                  type="email"
                  value={editForm.memedEmail}
                  onChange={(e) => setEditForm((f) => ({ ...f, memedEmail: e.target.value }))}
                  placeholder="conta pessoal do médico na Memed, só como referência"
                  className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
                />
              </label>
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
                </p>
                {d.memed_email && (
                  <p className="text-[11px] text-zinc-400">Memed: {d.memed_email}</p>
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
              className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm"
            >
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
  const [form, setForm] = useState({ patientId: "", doctorId: "", specialtyId: "", scheduledDate: "" });
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ doctorId: "", scheduledDate: "" });
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
      setForm({ patientId: "", doctorId: "", specialtyId: "", scheduledDate: "" });
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
    setEditForm({ doctorId: a.doctors?.id ?? "", scheduledDate: toDateInputValue(a.scheduled_at) });
  }

  async function saveEdit(id: string) {
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId: editForm.doctorId, scheduledDate: editForm.scheduledDate }),
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
