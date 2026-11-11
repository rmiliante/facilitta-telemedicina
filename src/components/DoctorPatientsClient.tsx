"use client";

import { useCallback, useEffect, useState } from "react";
import { DocumentsPanel } from "./DoctorDocuments";
import AddressFields, { type Endereco } from "./AddressFields";

interface PatientRow {
  id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  cep: string | null;
  address: string | null;
  address_number: string | null;
  address_complement: string | null;
  neighborhood: string | null;
  cns: string | null;
}

type Form = Endereco & { birthDate: string; phone: string; email: string };

const inputCls =
  "w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d + "/" + m + "/" + y;
}

function enderecoTexto(p: PatientRow) {
  const rua = [p.address, p.address_number, p.address_complement].filter(Boolean).join(", ");
  const cidade = [p.city, p.state].filter(Boolean).join("/");
  const partes = [rua, p.neighborhood, cidade, p.cep ? "CEP " + p.cep : ""].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : "—";
}

function Campo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-zinc-500">{label}</p>
      <p className="text-sm text-zinc-800">{value || "—"}</p>
    </div>
  );
}

/** Pacientes do médico fora de consulta: abre o cadastro, edita (com confirmação) e anexa documentos. */
export default function DoctorPatientsClient() {
  const [q, setQ] = useState("");
  const [list, setList] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async (term: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/doctor/patients?q=" + encodeURIComponent(term));
      if (res.ok) setList((await res.json()).patients ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  function startEdit(p: PatientRow) {
    setEditId(p.id);
    setForm({
      birthDate: p.birth_date ?? "",
      phone: p.phone ?? "",
      email: p.email ?? "",
      cep: p.cep ?? "",
      address: p.address ?? "",
      addressNumber: p.address_number ?? "",
      addressComplement: p.address_complement ?? "",
      neighborhood: p.neighborhood ?? "",
      city: p.city ?? "",
      state: p.state ?? "",
    });
  }

  async function saveEdit(p: PatientRow) {
    if (!form) return;
    if (!confirm("Confirmar a alteração dos dados de " + p.full_name + "?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/doctor/patients/" + p.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Não foi possível salvar.");
        return;
      }
      setEditId(null);
      await load(q);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-zinc-800">Pacientes</h1>
        <p className="text-xs text-zinc-500">Pacientes que já têm consulta com você. Abra o cadastro para ver os dados e anexar documentos.</p>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nome ou CPF..."
        className="w-full max-w-sm rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
      />
      {loading && list.length === 0 && <p className="text-sm text-zinc-500">Carregando…</p>}
      {!loading && list.length === 0 && <p className="text-sm text-zinc-500">Nenhum paciente encontrado.</p>}
      <ul className="space-y-2">
        {list.map((p) => {
          const open = openId === p.id;
          const editing = editId === p.id && form;
          return (
            <li key={p.id} className="rounded-md border border-zinc-200 bg-white text-sm">
              <div className="flex items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-800">{p.full_name}</p>
                  <p className="text-xs text-zinc-500">
                    {p.cpf ? "CPF " + p.cpf + " · " : ""}
                    {p.phone ?? p.email ?? ""}
                    {p.city ? " · " + p.city + (p.state ? "/" + p.state : "") : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {counts[p.id] != null && (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-800">
                      {counts[p.id]} {counts[p.id] === 1 ? "anexo" : "anexos"}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setOpenId(open ? null : p.id);
                      if (open) setEditId(null);
                    }}
                    className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    {open ? "Fechar cadastro" : "Abrir cadastro"}
                  </button>
                </div>
              </div>
              {open && (
                <div className="space-y-4 border-t border-zinc-200 px-4 py-3">
                  {editing && form ? (
                    <div>
                      <p className="mb-2 text-xs text-zinc-500">Nome e CPF não podem ser alterados aqui.</p>
                      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                        <label className="text-xs">
                          <span className="mb-1 block font-medium text-zinc-600">Data de nascimento</span>
                          <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className={inputCls} />
                        </label>
                        <label className="text-xs">
                          <span className="mb-1 block font-medium text-zinc-600">Celular</span>
                          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} />
                        </label>
                        <label className="text-xs sm:col-span-2">
                          <span className="mb-1 block font-medium text-zinc-600">E-mail</span>
                          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
                        </label>
                        <div className="sm:col-span-2">
                          <AddressFields
                            value={form}
                            onChange={(e) => setForm({ ...form, ...e })}
                            labelCls="mb-1 mt-2 block text-xs font-medium text-zinc-600"
                            inputCls={inputCls}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => saveEdit(p)}
                          disabled={saving}
                          className="rounded-md bg-brand-navy px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {saving ? "Salvando…" : "Salvar"}
                        </button>
                        <button onClick={() => setEditId(null)} className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm text-zinc-600">
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="grid gap-3 sm:grid-cols-4">
                        <Campo label="Nome" value={p.full_name} />
                        <Campo label="CPF" value={p.cpf ?? ""} />
                        <Campo label="Nascimento" value={formatDate(p.birth_date)} />
                        <Campo label="Celular" value={p.phone ?? ""} />
                        <div className="sm:col-span-2">
                          <Campo label="Endereço" value={enderecoTexto(p)} />
                        </div>
                        <Campo label="CNS" value={p.cns ?? ""} />
                        <Campo label="E-mail" value={p.email ?? ""} />
                      </div>
                      <button
                        onClick={() => startEdit(p)}
                        className="mt-3 rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        ✎ Editar dados
                      </button>
                    </div>
                  )}
                  <div className="border-t border-zinc-200 pt-3">
                    <p className="mb-2 text-sm font-semibold text-zinc-700">Anexos do paciente</p>
                    <DocumentsPanel
                      patientId={p.id}
                      onChange={(files) => setCounts((c) => ({ ...c, [p.id]: files.length }))}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
