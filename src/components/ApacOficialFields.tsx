"use client";

import type { Dispatch, SetStateAction } from "react";
import { OFICIAL_RACAS, type OficialData } from "@/lib/apacOficial";

/** Campos extras do laudo de APAC no modelo do Ministério da Saúde (SIA/SUS). */

const INPUT =
  "w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-brand-teal-dark";

export default function ApacOficialFields({
  oficial,
  setOficial,
  onPreview,
  previewing,
}: {
  oficial: OficialData;
  setOficial: Dispatch<SetStateAction<OficialData>>;
  onPreview: () => void;
  previewing: boolean;
}) {
  const set = (patch: Partial<OficialData>) => setOficial((prev) => ({ ...prev, ...patch }));
  const label = "mb-1 block font-medium text-zinc-600";
  const num = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

  return (
    <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand-navy">
          Campos do formulário oficial (Ministério da Saúde)
        </p>
        <button
          type="button"
          onClick={onPreview}
          disabled={previewing}
          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-brand-navy hover:bg-zinc-50 disabled:opacity-50"
        >
          {previewing ? "Gerando..." : "Pré-visualizar PDF"}
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block text-xs">
          <span className={label}>Código SIGTAP do procedimento</span>
          <input
            value={oficial.procCode}
            inputMode="numeric"
            onChange={(e) => set({ procCode: num(e.target.value, 10) })}
            placeholder="10 números"
            className={INPUT}
          />
        </label>
        <label className="block text-xs">
          <span className={label}>Nº do prontuário</span>
          <input value={oficial.prontuario} onChange={(e) => set({ prontuario: e.target.value })} className={INPUT} />
        </label>
        <label className="block text-xs">
          <span className={label}>Raça / cor</span>
          <select value={oficial.racaCor} onChange={(e) => set({ racaCor: e.target.value })} className={INPUT}>
            <option value="">—</option>
            {OFICIAL_RACAS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className={label}>Telefone do paciente</span>
          <input value={oficial.telefone} onChange={(e) => set({ telefone: e.target.value })} className={INPUT} />
        </label>
        <label className="block text-xs">
          <span className={label}>Nome do responsável</span>
          <input value={oficial.responsavel} onChange={(e) => set({ responsavel: e.target.value })} className={INPUT} />
        </label>
        <label className="block text-xs">
          <span className={label}>Telefone do responsável</span>
          <input value={oficial.telResponsavel} onChange={(e) => set({ telResponsavel: e.target.value })} className={INPUT} />
        </label>
        <label className="block text-xs">
          <span className={label}>Município de residência</span>
          <input value={oficial.municipality} onChange={(e) => set({ municipality: e.target.value })} className={INPUT} />
        </label>
        <label className="block text-xs">
          <span className={label}>Código IBGE (7 números)</span>
          <input
            value={oficial.ibge}
            inputMode="numeric"
            onChange={(e) => set({ ibge: num(e.target.value, 7) })}
            className={INPUT}
          />
        </label>
        <label className="block text-xs">
          <span className={label}>UF</span>
          <input
            value={oficial.uf}
            maxLength={2}
            onChange={(e) => set({ uf: e.target.value.toUpperCase() })}
            placeholder="BA"
            className={INPUT}
          />
        </label>
        <label className="block text-xs">
          <span className={label}>CID-10 causas associadas</span>
          <input value={oficial.cid3} onChange={(e) => set({ cid3: e.target.value })} className={INPUT} />
        </label>
        <label className="block text-xs sm:col-span-2">
          <span className={label}>CNS ou CPF do médico solicitante</span>
          <input value={oficial.solicitanteDoc} onChange={(e) => set({ solicitanteDoc: e.target.value })} className={INPUT} />
        </label>
      </div>
      <p className="text-[11px] text-zinc-500">
        O bloco de autorização (número da APAC, validade, executante) sai em branco: quem preenche é a regulação.
      </p>
    </div>
  );
}
