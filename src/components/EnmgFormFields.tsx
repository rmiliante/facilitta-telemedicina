"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  ENMG_COMORB_LABEL,
  ENMG_COMORB_ROWS,
  ENMG_MAX_HIPOTESES,
  ENMG_MAX_RESUMO,
  ENMG_PROC_LABEL,
  ENMG_PROC_ROWS,
  type ApacModel,
  type EnmgData,
} from "@/lib/enmgForm";

/** Campos do laudo de APAC no modelo da Secretaria de Saúde (eletroneuromiografia). */

export interface ApacExtra {
  cns: string;
  motherName: string;
  sex: string;
  address: string;
  cep: string;
  cid: string;
  cid2: string;
}

const INPUT =
  "w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-brand-teal-dark";
const LOCKED = "w-full rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1.5 text-sm text-zinc-600";

export function ApacModelTabs({ model, onChange }: { model: ApacModel; onChange: (m: ApacModel) => void }) {
  const tabs: [ApacModel, string][] = [
    ["enmg", "Modelo ENMG (Secretaria de Saúde)"],
    ["livre", "Laudo livre"],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            model === id ? "bg-brand-navy text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Box({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
      <input type="checkbox" checked={checked} onChange={onToggle} className="h-4 w-4 accent-brand-teal-dark" />
      {label}
    </label>
  );
}

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function formatBirth(iso: string | null) {
  const [y, m, d] = (iso ?? "").slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
}

export default function EnmgFormFields({
  patientName,
  birthDate,
  apac,
  setApac,
  enmg,
  setEnmg,
  notes,
  setNotes,
  onPreview,
  previewing,
}: {
  patientName: string;
  birthDate: string | null;
  apac: ApacExtra;
  setApac: Dispatch<SetStateAction<ApacExtra>>;
  enmg: EnmgData;
  setEnmg: Dispatch<SetStateAction<EnmgData>>;
  notes: string;
  setNotes: (v: string) => void;
  onPreview: () => void;
  previewing: boolean;
}) {
  const setA = (patch: Partial<ApacExtra>) => setApac((prev) => ({ ...prev, ...patch }));
  const setE = (patch: Partial<EnmgData>) => setEnmg((prev) => ({ ...prev, ...patch }));
  const heading = "mb-2 text-[11px] font-bold uppercase tracking-wide text-brand-navy";
  const label = "mb-1 block font-medium text-zinc-600";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          Formulário para solicitação de eletroneuromiografia. Campos com * são obrigatórios; os dados do paciente já
          preenchidos no cadastro aparecem aqui e o cadastro é atualizado ao emitir.
        </p>
        <button
          type="button"
          onClick={onPreview}
          disabled={previewing}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-zinc-50 disabled:opacity-50"
        >
          {previewing ? "Gerando..." : "Pré-visualizar PDF"}
        </button>
      </div>

      <section>
        <p className={heading}>II. Identificação do paciente</p>
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
          <label className="block text-xs">
            <span className={label}>Nome do paciente</span>
            <div className={LOCKED}>{patientName}</div>
          </label>
          <label className="block text-xs">
            <span className={label}>Data de nascimento</span>
            <div className={LOCKED}>{formatBirth(birthDate)}</div>
          </label>
          <label className="block text-xs">
            <span className={label}>Sexo *</span>
            <select value={apac.sex} onChange={(e) => setA({ sex: e.target.value })} className={INPUT}>
              <option value="">—</option>
              <option value="Feminino">Feminino</option>
              <option value="Masculino">Masculino</option>
            </select>
          </label>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
          <label className="block text-xs">
            <span className={label}>Endereço *</span>
            <input value={apac.address} onChange={(e) => setA({ address: e.target.value })} className={INPUT} />
          </label>
          <label className="block text-xs">
            <span className={label}>Município de residência *</span>
            <input value={enmg.municipality} onChange={(e) => setE({ municipality: e.target.value })} className={INPUT} />
          </label>
          <label className="block text-xs">
            <span className={label}>CNS (Cartão SUS) *</span>
            <input
              value={apac.cns}
              inputMode="numeric"
              onChange={(e) => setA({ cns: e.target.value.replace(/\D/g, "").slice(0, 15) })}
              placeholder="15 números"
              className={INPUT}
            />
          </label>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="block text-xs">
            <span className={label}>Telefone residencial</span>
            <input value={enmg.phoneHome} onChange={(e) => setE({ phoneHome: e.target.value })} placeholder="(  ) " className={INPUT} />
          </label>
          <label className="block text-xs">
            <span className={label}>Telefone celular</span>
            <input value={enmg.phoneMobile} onChange={(e) => setE({ phoneMobile: e.target.value })} placeholder="(  ) " className={INPUT} />
          </label>
        </div>
      </section>

      <section className="border-t border-zinc-200 pt-3">
        <p className={heading}>III. Procedimento solicitado *</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ENMG_PROC_ROWS.flat().map((id) => (
            <Box
              key={id}
              label={ENMG_PROC_LABEL[id]}
              checked={enmg.procedures.includes(id)}
              onToggle={() => setE({ procedures: toggle(enmg.procedures, id) })}
            />
          ))}
        </div>
      </section>

      <section className="border-t border-zinc-200 pt-3">
        <p className={heading}>IV. Resumo da história clínica *</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
          <label className="block text-xs">
            <span className={label}>
              Resumo ({notes.length}/{ENMG_MAX_RESUMO})
            </span>
            <textarea
              value={notes}
              maxLength={ENMG_MAX_RESUMO}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-zinc-300 p-2 text-sm outline-none focus:border-brand-teal-dark"
            />
          </label>
          <label className="block text-xs">
            <span className={label}>CID-10 *</span>
            <input value={apac.cid} onChange={(e) => setA({ cid: e.target.value })} placeholder="Ex.: G62.9" className={INPUT} />
          </label>
        </div>
      </section>

      <section className="border-t border-zinc-200 pt-3">
        <p className={heading}>V. Patologia concomitante</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {ENMG_COMORB_ROWS.flat().map((id) => (
            <Box
              key={id}
              label={ENMG_COMORB_LABEL[id]}
              checked={enmg.comorbidities.includes(id)}
              onToggle={() => setE({ comorbidities: toggle(enmg.comorbidities, id) })}
            />
          ))}
        </div>
        <label className="mt-3 block text-xs">
          <span className={label}>
            Hipótese(s) diagnóstica(s) que motiva(m) a solicitação * ({enmg.hypotheses.length}/{ENMG_MAX_HIPOTESES})
          </span>
          <textarea
            value={enmg.hypotheses}
            maxLength={ENMG_MAX_HIPOTESES}
            onChange={(e) => setE({ hypotheses: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-zinc-300 p-2 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
      </section>

      <p className="text-[11px] text-zinc-500">
        A data da solicitação, o seu nome e CRM e a assinatura digital entram sozinhos no PDF.
      </p>
    </div>
  );
}
