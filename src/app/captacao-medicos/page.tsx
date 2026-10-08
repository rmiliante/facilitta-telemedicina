"use client";

import { useEffect, useRef, useState } from "react";
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

const NO_RQE = ["Clínico Geral", "Psicologia", "Nutrição", "Outra"];
const CARE_MODES = [
  { key: "consulta", label: "Por consulta" },
  { key: "plantao", label: "Plantão" },
  { key: "ambos", label: "Ambos" },
] as const;

const UTM_KEYS = ["utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm"] as const;

function readTracking() {
  const params = new URLSearchParams(window.location.search);
  const t: Record<string, string> = {
    utmSource: params.get("utm_source") ?? "",
    utmMedium: params.get("utm_medium") ?? "",
    utmCampaign: params.get("utm_campaign") ?? "",
    utmContent: params.get("utm_content") ?? "",
    utmTerm: params.get("utm_term") ?? "",
    referrer: document.referrer ?? "",
  };
  // Cliques de anúncios sem UTM: marca a origem pelo identificador do clique.
  if (!t.utmSource && params.get("fbclid")) t.utmSource = "facebook";
  if (!t.utmSource && params.get("gclid")) t.utmSource = "google";
  const ua = navigator.userAgent;
  t.device = /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|Android|iPhone/i.test(ua) ? "celular" : "computador";
  let sid = "";
  try {
    sid = sessionStorage.getItem("cap_sid") ?? "";
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem("cap_sid", sid);
    }
  } catch {
    sid = crypto.randomUUID();
  }
  t.sessionId = sid;
  return t;
}

function sendEvent(event: "view" | "start", t: Record<string, string>) {
  void fetch("/api/public/captacao-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, ...t }),
    keepalive: true,
  }).catch(() => {});
}

export default function DoctorApplicationPage() {
  const [days, setDays] = useState<string[]>([]);
  const [shifts, setShifts] = useState<string[]>([]);
  const [specialty, setSpecialty] = useState("");
  const [careMode, setCareMode] = useState<string>("");
  const [hasRqe, setHasRqe] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const tracking = useRef<Record<string, string>>({});
  const started = useRef(false);

  useEffect(() => {
    tracking.current = readTracking();
    sendEvent("view", tracking.current);
  }, []);

  function markStarted() {
    if (started.current) return;
    started.current = true;
    sendEvent("start", tracking.current);
  }

  function toggle(list: string[], setList: (v: string[]) => void, key: string) {
    markStarted();
    setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  }

  const askRqe = specialty !== "" && !NO_RQE.includes(specialty);
  const showConsult = careMode === "consulta" || careMode === "ambos";
  const showShift = careMode === "plantao" || careMode === "ambos";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const formData = new FormData(e.currentTarget);
      days.forEach((d) => formData.append("availableDays", d));
      shifts.forEach((s) => formData.append("availableShifts", s));
      formData.set("careMode", careMode);
      formData.set("hasRqe", askRqe ? hasRqe : "");
      if (!showConsult) formData.delete("consultPrice");
      if (!showShift) formData.delete("shiftPrice");
      for (const k of [...UTM_KEYS, "referrer", "device", "sessionId"]) {
        formData.set(k, tracking.current[k] ?? "");
      }

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
          onChange={markStarted}
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>WhatsApp</span>
              <input required type="tel" name="whatsapp" className={inputClass} placeholder="(11) 98421-3390" />
            </label>
            <label className="block">
              <span className={labelClass}>E-mail</span>
              <input required type="email" name="email" className={inputClass} placeholder="voce@email.com" />
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

          <label className="block">
            <span className={labelClass}>Especialidade principal</span>
            <select
              required
              name="specialty"
              value={specialty}
              onChange={(e) => {
                setSpecialty(e.target.value);
                setHasRqe("");
              }}
              className={inputClass}
            >
              <option value="" disabled>
                —
              </option>
              {SPECIALTIES.map((sp) => (
                <option key={sp} value={sp}>
                  {sp}
                </option>
              ))}
            </select>
          </label>

          {askRqe && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-brand-teal/10 px-4 py-3">
              <span className="text-sm font-medium text-zinc-700">Possui RQE?</span>
              <div role="group" className="flex gap-2">
                <Pill selected={hasRqe === "sim"} onClick={() => setHasRqe("sim")}>
                  Sim
                </Pill>
                <Pill selected={hasRqe === "nao"} onClick={() => setHasRqe("nao")}>
                  Não
                </Pill>
              </div>
            </div>
          )}

          <label className="block max-w-[220px]">
            <span className={labelClass}>Anos de experiência</span>
            <input type="number" min={0} name="experienceYears" className={inputClass} />
          </label>

          <div>
            <span className={labelClass}>Como prefere atuar?</span>
            <div role="group" className="flex flex-wrap gap-2">
              {CARE_MODES.map((m) => (
                <Pill
                  key={m.key}
                  selected={careMode === m.key}
                  onClick={() => {
                    markStarted();
                    setCareMode(m.key);
                  }}
                >
                  {m.label}
                </Pill>
              ))}
            </div>
          </div>

          {(showConsult || showShift) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {showConsult && (
                <label className="block">
                  <span className={labelClass}>Valor por consulta (R$)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    name="consultPrice"
                    className={inputClass}
                    placeholder="Ex.: 60"
                  />
                </label>
              )}
              {showShift && (
                <label className="block">
                  <span className={labelClass}>Plantão de 8 horas (R$)</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    name="shiftPrice"
                    className={inputClass}
                    placeholder="Ex.: 500"
                  />
                </label>
              )}
              <p className="text-xs text-zinc-500 sm:col-span-2">
                Pode deixar em branco se preferir combinar o valor com a nossa equipe.
              </p>
            </div>
          )}

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
              {SHIFTS.map((sh) => (
                <Pill
                  key={sh.key}
                  selected={shifts.includes(sh.key)}
                  onClick={() => toggle(shifts, setShifts, sh.key)}
                >
                  {sh.label}
                </Pill>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-xs leading-relaxed text-zinc-600">
            <input required type="checkbox" className="mt-0.5" />
            Li e concordo com o{" "}
            <a
              href="/termos-captacao"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-navy underline"
            >
              termo de autorização de contato
            </a>{" "}
            da Facilitta Saúde.
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
