"use client";

import { useState } from "react";
import { BRAZIL_STATES, SHIFTS, SPECIALTIES, WEEKDAYS } from "@/lib/doctorApplications";

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-800 outline-none focus:border-brand-navy";
const labelClass = "mb-1.5 block text-xs font-semibold text-zinc-600";

function Pill({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        selected
          ? "border-brand-navy bg-brand-navy text-white"
          : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400"
      }`}
    >
      {children}
    </button>
  );
}

export default function DoctorApplicationPage() {
  const [days, setDays] = useState<string[]>([]);
  const [shifts, setShifts] = useState<string[]>([]);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function toggle(list: string[], setList: (v: string[]) => void, key: string) {
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      days.forEach((d) => formData.append("availableDays", d));
      shifts.forEach((s) => formData.append("availableShifts", s));

      const res = await fetch("/api/public/doctor-applications", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Não foi possível enviar seu cadastro");
        return;
      }
      setDone(true);
    } catch {
      setError("Não foi possível enviar seu cadastro. Verifique sua conexão e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4">
        <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal/15 text-brand-teal-dark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-6 w-6">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-brand-navy">Cadastro enviado!</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Obrigado pelo interesse em atender pela Facilitta Saúde. Nossa equipe analisa seu
            cadastro e entra em contato pelo WhatsApp em até 3 dias úteis.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-16">
      <div className="bg-brand-navy px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-facilitta.png"
            alt=""
            className="h-7 w-7 rounded-md"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="text-base font-semibold leading-none text-white">
            facilitta<span className="text-brand-teal"> saúde</span>
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-10">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-teal-dark">
          Facilitta Saúde · Rede credenciada
        </p>
        <h1 className="text-3xl font-semibold text-zinc-900">
          Cadastre-se para atender pela Facilitta
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-600">
          Preencha seus dados abaixo. Nossa equipe analisa cada cadastro e entra em contato pelo
          WhatsApp em até 3 dias úteis.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm"
        >
          {/* Honeypot anti-spam, invisível pra gente e pro leitor de tela */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            className="absolute -left-[9999px] h-0 w-0 opacity-0"
            aria-hidden="true"
          />

          <label className="block">
            <span className={labelClass}>Nome completo</span>
            <input required name="name" className={inputClass} placeholder="Dra. Ana Paula Ribeiro" />
          </label>

          <div className="grid grid-cols-[2fr_1fr] gap-4">
            <label className="block">
              <span className={labelClass}>CRM</span>
              <input required name="crm" className={inputClass} placeholder="45231" />
            </label>
            <label className="block">
              <span className={labelClass}>UF do CRM</span>
              <select required name="crmUf" defaultValue="" className={inputClass}>
                <option value="" disabled>
                  —
                </option>
                {BRAZIL_STATES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-[2fr_1fr] gap-4">
            <label className="block">
              <span className={labelClass}>Especialidade principal</span>
              <select required name="specialty" defaultValue="" className={inputClass}>
                <option value="" disabled>
                  —
                </option>
                {SPECIALTIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Anos de experiência</span>
              <input type="number" min={0} name="experienceYears" className={inputClass} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={labelClass}>E-mail</span>
              <input required type="email" name="email" className={inputClass} placeholder="voce@email.com" />
            </label>
            <label className="block">
              <span className={labelClass}>WhatsApp</span>
              <input required type="tel" name="whatsapp" className={inputClass} placeholder="(11) 98421-3390" />
            </label>
          </div>

          <div className="grid grid-cols-[2fr_1fr] gap-4">
            <label className="block">
              <span className={labelClass}>Cidade</span>
              <input required name="city" className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Estado</span>
              <select required name="state" defaultValue="" className={inputClass}>
                <option value="" disabled>
                  —
                </option>
                {BRAZIL_STATES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block max-w-[220px]">
            <span className={labelClass}>Valor pretendido por consulta (R$)</span>
            <input type="number" min={0} step="0.01" name="consultPrice" className={inputClass} />
          </label>

          <div>
            <span className={labelClass}>Dias disponíveis</span>
            <div role="group" className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <Pill
                  key={d.key}
                  selected={days.includes(d.key)}
                  onClick={() => toggle(days, setDays, d.key)}
                >
                  {d.label}
                </Pill>
              ))}
            </div>
          </div>

          <div>
            <span className={labelClass}>Turno disponível</span>
            <div role="group" className="flex flex-wrap gap-2">
              {SHIFTS.map((s) => (
                <Pill
                  key={s.key}
                  selected={shifts.includes(s.key)}
                  onClick={() => toggle(shifts, setShifts, s.key)}
                >
                  {s.label}
                </Pill>
              ))}
            </div>
          </div>

          <label className="block">
            <span className={labelClass}>Foto de perfil (opcional)</span>
            <div className="relative flex items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-4 text-sm">
              <span className="flex-1 truncate text-zinc-600">
                {photoName ?? "Nenhum arquivo selecionado"}
              </span>
              <span className="shrink-0 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700">
                Escolher arquivo
              </span>
              <input
                type="file"
                name="photo"
                accept="image/*"
                onChange={(e) => setPhotoName(e.target.files?.[0]?.name ?? null)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>
          </label>

          <label className="block">
            <span className={labelClass}>Breve apresentação</span>
            <textarea
              name="presentation"
              rows={3}
              className={`${inputClass} resize-none`}
              placeholder="Conte um pouco da sua experiência e área de atuação"
            />
          </label>

          <label className="flex items-start gap-2.5 text-xs leading-relaxed text-zinc-600">
            <input required type="checkbox" className="mt-0.5" />
            Li e aceito os termos de credenciamento e a política de privacidade da Facilitta
            Saúde.
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-teal px-8 py-3 text-sm font-semibold text-brand-navy disabled:opacity-50"
          >
            {submitting ? "Enviando..." : "Enviar cadastro"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-zinc-400">
          Facilitta Saúde · www.facilittasaude.com.br
        </p>
      </div>
    </div>
  );
}
