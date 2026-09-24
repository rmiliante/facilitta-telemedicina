"use client";

import { useCallback, useEffect, useState } from "react";
import LogoutButton from "./LogoutButton";

interface Doctor {
  id: string;
  name: string;
  specialty_id: string | null;
  active: boolean;
  specialties: { name: string } | null;
}

interface Specialty {
  id: string;
  name: string;
  monthly_quota: number;
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

interface QueueItem {
  id: string;
  scheduled_at: string;
  status: string;
  access_token: string;
  queue_position: number | null;
  called_at: string | null;
  booth_rejected_at: string | null;
  patients: { id: string; full_name: string } | null;
  doctors: { id: string; name: string } | null;
  specialties: { id: string; name: string } | null;
}

type Tab = "fila" | "pacientes";

// ------------------------------------------------------------
// Ícones
// ------------------------------------------------------------
function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function IconQueue() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M4 6h11M4 12h11M4 18h7" strokeLinecap="round" />
      <circle cx="19" cy="12" r="2.2" />
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

const NAV_ITEMS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "fila", label: "Fila de atendimento", icon: <IconQueue /> },
  { key: "pacientes", label: "Pacientes", icon: <IconUsers /> },
];

function todayIso() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface BoothAlert {
  id: string;
  patients: { full_name: string } | null;
  doctors: { name: string } | null;
}

const ALERT_POLL_INTERVAL_MS = 5000;

export default function StaffPanel({ staffName }: { staffName: string }) {
  const [tab, setTab] = useState<Tab>("fila");
  const [navOpen, setNavOpen] = useState(false);
  const [alerts, setAlerts] = useState<BoothAlert[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/admin/appointments/booth-alerts");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setAlerts(data.alerts ?? []);
        }
      } catch {
        // silencioso — só tenta de novo no próximo ciclo
      }
    }

    poll();
    const interval = setInterval(poll, ALERT_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function dismissAlert(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/admin/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearBoothRejected: true }),
    });
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-brand-bg">
      <nav
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 -translate-x-full flex-col border-r border-zinc-200 bg-white transition-transform duration-200 md:static md:z-auto md:w-56 md:translate-x-0 ${
          navOpen ? "translate-x-0" : ""
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
            onClick={() => setNavOpen(false)}
            aria-label="Fechar menu"
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 md:hidden"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-4">
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Atendimento
          </p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => {
                    setTab(item.key);
                    setNavOpen(false);
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

        <div className="border-t border-zinc-100 px-4 py-3">
          <p className="mb-2 truncate text-xs font-medium text-zinc-500">{staffName}</p>
          <LogoutButton redirectTo="/equipe/login" />
        </div>
      </nav>

      {navOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setNavOpen(false)} />
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
          <h1 className="text-sm font-semibold text-white">Atendimento — Facilitta Telemedicina</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-3xl">
            {alerts.length > 0 && (
              <div className="mb-4 space-y-2">
                {alerts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm"
                  >
                    <p className="text-amber-800">
                      <strong>{a.patients?.full_name ?? "Paciente"}</strong> disse &quot;Não sou
                      eu&quot; na cabine
                      {a.doctors?.name ? ` (fila de ${a.doctors.name})` : ""}. Confira quem chegou e
                      envie o paciente certo.
                    </p>
                    <button
                      onClick={() => dismissAlert(a.id)}
                      className="shrink-0 rounded-md border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                    >
                      OK
                    </button>
                  </div>
                ))}
              </div>
            )}
            {tab === "fila" && <FilaTab />}
            {tab === "pacientes" && <PacientesTab />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Fila de atendimento
// ------------------------------------------------------------
const STATUS_LABELS: Record<string, string> = {
  agendado: "Aguardando",
  em_andamento: "Em atendimento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  faltou: "Faltou",
};

function FilaTab() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ patientId: "", specialtyId: "" });
  const [adding, setAdding] = useState(false);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false);
  const [boothCopied, setBoothCopied] = useState(false);

  function copyBoothLink() {
    const url = `${window.location.origin}/atendimento`;
    navigator.clipboard.writeText(url).then(() => {
      setBoothCopied(true);
      setTimeout(() => setBoothCopied(false), 2000);
    });
  }

  const loadBase = useCallback(async () => {
    const [dRes, sRes, pRes] = await Promise.all([
      fetch("/api/admin/doctors"),
      fetch("/api/admin/specialties"),
      fetch("/api/admin/patients"),
    ]);
    if (dRes.ok) {
      const data = (await dRes.json()).doctors as Doctor[];
      setDoctors(data);
      if (!doctorId && data.length > 0) {
        setDoctorId(data[0].id);
        if (data[0].specialty_id) {
          setAddForm((f) => ({ ...f, specialtyId: data[0].specialty_id as string }));
        }
      }
    }
    if (sRes.ok) setSpecialties((await sRes.json()).specialties);
    if (pRes.ok) setPatients((await pRes.json()).patients);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadQueue = useCallback(async (docId: string, day: string) => {
    if (!docId || !day) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/appointments/queue?doctorId=${docId}&date=${day}`);
      if (res.ok) setQueue((await res.json()).appointments);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(loadBase, 0);
    return () => clearTimeout(timeout);
  }, [loadBase]);

  useEffect(() => {
    const timeout = setTimeout(() => loadQueue(doctorId, date), 0);
    return () => clearTimeout(timeout);
  }, [doctorId, date, loadQueue]);

  async function saveOrder(newQueue: QueueItem[]) {
    setQueue(newQueue);
    await fetch("/api/admin/appointments/queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorId, date, orderedIds: newQueue.map((q) => q.id) }),
    });
  }

  function moveUp(index: number) {
    if (index === 0) return;
    const next = [...queue];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    saveOrder(next);
  }

  function moveDown(index: number) {
    if (index === queue.length - 1) return;
    const next = [...queue];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    saveOrder(next);
  }

  async function markCalled(item: QueueItem) {
    await fetch(`/api/admin/appointments/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markCalled: true, status: "em_andamento" }),
    });
    await loadQueue(doctorId, date);
  }

  async function dismissBoothRejected(item: QueueItem) {
    await fetch(`/api/admin/appointments/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clearBoothRejected: true }),
    });
    await loadQueue(doctorId, date);
  }

  async function removeFromQueue(item: QueueItem) {
    if (!confirm(`Remover "${item.patients?.full_name}" da fila? A consulta continua agendada, mas sem posição na fila.`)) return;
    await fetch(`/api/admin/appointments/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queuePosition: null }),
    });
    await loadQueue(doctorId, date);
  }

  async function cancelAppointment(item: QueueItem) {
    if (!confirm(`Cancelar a consulta de "${item.patients?.full_name}"?`)) return;
    await fetch(`/api/admin/appointments/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelado" }),
    });
    await loadQueue(doctorId, date);
  }

  function copyLink(item: QueueItem) {
    const url = `${window.location.origin}/paciente/${item.access_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const selectedDoctor = doctors.find((d) => d.id === doctorId);
  const selectedPatient = patients.find((p) => p.id === addForm.patientId);

  const onlyDigits = (s: string) => s.replace(/\D/g, "");
  const normalizedQuery = patientQuery.trim().toLowerCase();
  const queryDigits = onlyDigits(patientQuery);
  const filteredPatients =
    normalizedQuery.length === 0
      ? patients
      : patients.filter((p) => {
          const nameMatch = p.full_name.toLowerCase().includes(normalizedQuery);
          const cpfMatch = queryDigits.length > 0 && (p.cpf ?? "").replace(/\D/g, "").includes(queryDigits);
          return nameMatch || cpfMatch;
        });

  function selectPatient(p: Patient) {
    setAddForm((f) => ({ ...f, patientId: p.id }));
    setPatientQuery(p.full_name);
    setPatientDropdownOpen(false);
  }

  async function handleAddToQueue(e: React.FormEvent) {
    e.preventDefault();
    if (!doctorId || !date) return;
    if (!addForm.patientId) {
      alert("Selecione um paciente na busca antes de confirmar.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: addForm.patientId,
          doctorId,
          specialtyId: addForm.specialtyId,
          scheduledDate: date,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error);
        return;
      }
      setAddForm({ patientId: "", specialtyId: "" });
      setPatientQuery("");
      setShowAddForm(false);
      await loadQueue(doctorId, date);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-teal-dark bg-brand-teal/10 px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-brand-navy">Link fixo da cabine de atendimento</p>
          <p className="text-[11px] text-zinc-500">
            Mesmo link sempre — deixe aberto no computador da cabine.
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

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4">
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Médico</span>
          <select
            value={doctorId}
            onChange={(e) => {
              const newDoctorId = e.target.value;
              setDoctorId(newDoctorId);
              const doc = doctors.find((d) => d.id === newDoctorId);
              if (doc?.specialty_id) {
                setAddForm((f) => ({ ...f, specialtyId: doc.specialty_id as string }));
              }
            }}
            className="w-full min-w-[12rem] rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          >
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} {d.specialties?.name ? `— ${d.specialties.name}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block font-medium text-zinc-600">Data</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
        <button
          type="button"
          onClick={() => setDate(todayIso())}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
        >
          Hoje
        </button>
        <button
          type="button"
          onClick={() => {
            setShowAddForm((s) => !s);
            setAddForm({ patientId: "", specialtyId: "" });
            setPatientQuery("");
            setPatientDropdownOpen(false);
          }}
          className="ml-auto rounded-md bg-brand-navy px-4 py-1.5 text-sm font-medium text-white"
        >
          {showAddForm ? "Cancelar" : "+ Adicionar à fila"}
        </button>
      </div>

      {showAddForm && (
        <form
          onSubmit={handleAddToQueue}
          className="grid gap-3 rounded-lg border border-brand-teal-dark bg-white p-4 sm:grid-cols-2"
        >
          <label className="relative text-xs">
            <span className="mb-1 block font-medium text-zinc-600">Paciente (nome ou CPF)</span>
            <input
              type="text"
              required
              autoComplete="off"
              value={patientQuery}
              onChange={(e) => {
                setPatientQuery(e.target.value);
                setAddForm((f) => ({ ...f, patientId: "" }));
                setPatientDropdownOpen(true);
              }}
              onFocus={() => setPatientDropdownOpen(true)}
              onBlur={() => setTimeout(() => setPatientDropdownOpen(false), 150)}
              placeholder="Digite pra buscar..."
              className="w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
            />
            {selectedPatient && !patientDropdownOpen && (
              <span className="mt-1 block text-[11px] text-brand-teal-dark">
                Selecionado: {selectedPatient.full_name}
              </span>
            )}
            {patientDropdownOpen && (
              <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white text-sm shadow-lg">
                {filteredPatients.length === 0 ? (
                  <li className="px-3 py-2 text-xs text-zinc-400">
                    Nenhum paciente encontrado. Cadastre em &quot;Pacientes&quot; primeiro.
                  </li>
                ) : (
                  filteredPatients.slice(0, 30).map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectPatient(p)}
                        className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-zinc-50"
                      >
                        <span className="font-medium text-zinc-800">{p.full_name}</span>
                        <span className="text-[11px] text-zinc-500">
                          {p.cpf ? `CPF ${p.cpf}` : "sem CPF cadastrado"}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </label>
          <label className="text-xs">
            <span className="mb-1 block font-medium text-zinc-600">Especialidade</span>
            <select
              required
              value={addForm.specialtyId}
              onChange={(e) => setAddForm((f) => ({ ...f, specialtyId: e.target.value }))}
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
          <div className="sm:col-span-2">
            <button
              disabled={adding}
              className="rounded-md bg-brand-navy px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Entrar na fila de {selectedDoctor?.name ?? "médico"}
            </button>
            <p className="mt-1 text-[11px] text-zinc-400">
              Não encontrou o paciente? Cadastre em &quot;Pacientes&quot; primeiro.
            </p>
          </div>
        </form>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700">
          Fila de {selectedDoctor?.name ?? "—"} em{" "}
          {new Date(`${date}T12:00:00.000Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
        </h2>

        {loading ? (
          <p className="text-xs text-zinc-400">Carregando...</p>
        ) : queue.length === 0 ? (
          <p className="text-xs text-zinc-400">Nenhum paciente na fila desse dia ainda.</p>
        ) : (
          <ul className="space-y-2">
            {queue.map((item, index) => (
              <li
                key={item.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-md border bg-white px-4 py-3 text-sm ${
                  item.booth_rejected_at
                    ? "border-amber-400 ring-2 ring-amber-300"
                    : index === 0 && item.status === "agendado"
                      ? "border-brand-teal-dark ring-1 ring-brand-teal/40"
                      : "border-zinc-200"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-white ${
                      item.booth_rejected_at
                        ? "bg-amber-500 ring-4 ring-amber-300"
                        : "bg-brand-navy"
                    }`}
                  >
                    {index + 1}º
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`truncate font-medium ${
                        item.booth_rejected_at ? "text-amber-800" : "text-zinc-800"
                      }`}
                    >
                      {item.patients?.full_name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {item.specialties?.name ?? ""}
                      {index === 0 && item.status === "agendado" ? " · próximo da fila" : ""}
                    </p>
                    {item.booth_rejected_at && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        Disse &quot;não sou eu&quot; na cabine — confira antes de reenviar
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  {item.booth_rejected_at && (
                    <button
                      onClick={() => dismissBoothRejected(item)}
                      className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-100"
                    >
                      OK, entendi
                    </button>
                  )}
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                    {STATUS_LABELS[item.status] ?? item.status}
                  </span>
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
                    title="Mover pra cima"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === queue.length - 1}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-50 disabled:opacity-30"
                    title="Mover pra baixo"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => copyLink(item)}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50"
                  >
                    {copiedId === item.id ? "Copiado!" : "Copiar link"}
                  </button>
                  {item.status === "agendado" && (
                    <button
                      onClick={() => markCalled(item)}
                      title="Manda esse paciente pra tela da cabine de atendimento, mesmo que não seja o primeiro da fila"
                      className="rounded-md bg-brand-teal-dark px-2.5 py-1 text-[10px] font-medium text-white hover:opacity-90"
                    >
                      Enviar para atendimento
                    </button>
                  )}
                  <button
                    onClick={() => removeFromQueue(item)}
                    className="rounded-md border border-zinc-300 px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-50"
                  >
                    Remover da fila
                  </button>
                  <button
                    onClick={() => cancelAppointment(item)}
                    className="rounded-md border border-red-200 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50"
                  >
                    Cancelar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Pacientes (cadastro rápido, mesmo endpoint usado no admin)
// ------------------------------------------------------------
function PacientesTab() {
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
          </li>
        ))}
        {patients.length === 0 && <p className="text-xs text-zinc-400">Nenhum paciente encontrado.</p>}
      </ul>
    </div>
  );
}
