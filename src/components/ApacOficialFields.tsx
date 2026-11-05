"use client";

import type { Dispatch, SetStateAction } from "react";
import { OFICIAL_MAX_SECUNDARIOS, OFICIAL_PROCEDURES, OFICIAL_RACAS, sugerirDiagnostico, type OficialData } from "@/lib/apacOficial";

/** Campos extras do laudo de APAC no modelo do Ministério da Saúde (SIA/SUS). */

const INPUT =
  "w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-brand-teal-dark";

export default function ApacOficialFields({
  oficial,
  setOficial,
  onPreview,
  previewing,
  onPickProcedure,
  cid,
}: {
  oficial: OficialData;
  setOficial: Dispatch<SetStateAction<OficialData>>;
  onPreview: () => void;
  previewing: boolean;
  onPickProcedure?: (name: string) => void;
  /** CID-10 principal informado acima (usado para sugerir a descrição do diagnóstico). */
  cid?: string;
}) {
  const sugestao = cid ? sugerirDiagnostico(cid) : "";
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
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-xs sm:col-span-2">
          <span className={label}>Exame (atalho SIGTAP: tomografia, ressonância, medicina nuclear)</span>
          <select
            value={OFICIAL_PROCEDURES.find((p) => p.code === oficial.procCode)?.code ?? ""}
            onChange={(e) => {
              const p = OFICIAL_PROCEDURES.find((x) => x.code === e.target.value);
              if (!p) return;
              set({ procCode: p.code, secundarios: [] });
              onPickProcedure?.(p.name);
            }}
            className={INPUT}
          >
            <option value="">Escolher da lista (ou digite o código abaixo)</option>
            {["Tomografia", "Ressonância magnética", "Medicina nuclear"].map((g) => (
              <optgroup key={g} label={g}>
                {OFICIAL_PROCEDURES.filter((p) => p.group === g).map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {(() => {
          const c = OFICIAL_PROCEDURES.find((p) => p.code === oficial.procCode)?.contrast;
          if (!c) return null;
          const on = oficial.secundarios.some((x) => x.code === c.code);
          return (
            <label className="flex items-center gap-2 text-xs sm:col-span-2">
              <input
                type="checkbox"
                checked={on}
                onChange={(e) =>
                  set({
                    secundarios: e.target.checked
                      ? [...oficial.secundarios, { code: c.code, name: c.name, qty: "1" }].slice(0, OFICIAL_MAX_SECUNDARIOS)
                      : oficial.secundarios.filter((x) => x.code !== c.code),
                  })
                }
              />
              <span>Com contraste (inclui “{c.name}” como procedimento secundário)</span>
            </label>
          );
        })()}
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
        <label className="block text-xs">
          <span className={label}>Etnia (se indígena)</span>
          <input value={oficial.etnia} onChange={(e) => set({ etnia: e.target.value })} className={INPUT} />
        </label>
        <label className="block text-xs sm:col-span-3">
          <span className={label}>Descrição do diagnóstico (campo 36)</span>
          <input value={oficial.diagnostico} maxLength={150} onChange={(e) => set({ diagnostico: e.target.value })} className={INPUT} />
          {sugestao && oficial.diagnostico.trim() === "" && (
            <button type="button" onClick={() => set({ diagnostico: sugestao })} className="mt-1 text-[11px] font-medium text-brand-navy underline">
              Usar sugestão pelo CID: {sugestao}
            </button>
          )}
        </label>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-600">Procedimentos secundários (até {OFICIAL_MAX_SECUNDARIOS})</span>
          {oficial.secundarios.length < OFICIAL_MAX_SECUNDARIOS && (
            <button type="button" className="text-xs font-medium text-brand-navy underline" onClick={() => set({ secundarios: [...oficial.secundarios, { code: "", name: "", qty: "1" }] })}>
              + adicionar
            </button>
          )}
        </div>
        {oficial.secundarios.map((sec, i) => {
          const upd = (patch: Partial<typeof sec>) => set({ secundarios: oficial.secundarios.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
          return (
            <div key={i} className="grid grid-cols-[9rem_1fr_3.5rem_auto] gap-1">
              <input value={sec.code} inputMode="numeric" placeholder="Código" onChange={(e) => upd({ code: num(e.target.value, 10) })} className={INPUT} />
              <input value={sec.name} placeholder="Nome" onChange={(e) => upd({ name: e.target.value })} className={INPUT} />
              <input value={sec.qty} placeholder="Qtd" onChange={(e) => upd({ qty: num(e.target.value, 3) })} className={INPUT} />
              <button type="button" aria-label="Remover" className="px-2 text-zinc-500" onClick={() => set({ secundarios: oficial.secundarios.filter((_, j) => j !== i) })}>
                ×
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-zinc-500">
        O bloco de autorização (número da APAC, validade, executante) sai em branco: quem preenche é a regulação.
      </p>
    </div>
  );
}
