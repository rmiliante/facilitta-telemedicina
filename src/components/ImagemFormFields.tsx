"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  IMAGEM_CONTRASTE_LABEL,
  IMAGEM_MAX_DETALHE,
  IMAGEM_MAX_HIPOTESES,
  IMAGEM_MAX_RESUMO,
  IMAGEM_REGIOES,
  IMAGEM_SAFETY_LABEL,
  IMAGEM_SAFETY_ROWS,
  IMAGEM_TIPOS,
  IMAGEM_TIPO_LABEL,
  imagemUsaContraste,
  type ImagemContraste,
  type ImagemData,
  type ImagemTipo,
} from "@/lib/imagemForm";
import type { ApacExtra } from "@/components/EnmgFormFields";

/** Campos da solicitação de ressonância, tomografia e cintilografia. */

const INPUT =
  "w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-brand-teal-dark";
const LOCKED = "w-full rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1.5 text-sm text-zinc-600";

function formatBirth(iso: string | null) {
  const [y, m, d] = (iso ?? "").slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
}

export default function ImagemFormFields({
  patientName,
  birthDate,
  apac,
  setApac,
  imagem,
  setImagem,
  notes,
  setNotes,
  onPreview,
  previewing,
}: {
  patientName: string;
  birthDate: string | null;
  apac: ApacExtra;
  setApac: Dispatch<SetStateAction<ApacExtra>>;
  imagem: ImagemData;
  setImagem: Dispatch<SetStateAction<ImagemData>>;
  notes: string;
  setNotes: (v: string) => void;
  onPreview: () => void;
  previewing: boolean;
}) {
  const setA = (patch: Partial<ApacExtra>) => setApac((prev) => ({ ...prev, ...patch }));
  const setI = (patch: Partial<ImagemData>) => setImagem((prev) => ({ ...prev, ...patch }));
  const heading = "mb-2 text-[11px] font-bold uppercase tracking-wide text-brand-navy";
  const label = "mb-1 block font-medium text-zinc-600";
  const toggleSafety = (id: string) =>
    setI({ safety: imagem.safety.includes(id) ? imagem.safety.filter((x) => x !== id) : [...imagem.safety, id] });
  const pill = (on: boolean) =>
    `rounded-full px-3 py-1 text-xs font-medium ${on ? "bg-brand-teal-dark text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500">
          Solicitação de ressonância, tomografia ou cintilografia. Campos com * são obrigatórios; os dados do paciente
          já preenchidos no cadastro aparecem aqui e o cadastro é atualizado ao emitir.
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
            <input value={imagem.municipality} onChange={(e) => setI({ municipality: e.target.value })} className={INPUT} />
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
        <label className="mt-2 block text-xs sm:w-1/2">
          <span className={label}>Telefone</span>
          <input value={imagem.phoneMobile} onChange={(e) => setI({ phoneMobile: e.target.value })} placeholder="(  ) " className={INPUT} />
        </label>
      </section>

      <section className="border-t border-zinc-200 pt-3">
        <p className={heading}>III. Exame solicitado *</p>
        <div className="mb-2 flex flex-wrap gap-2">
          {IMAGEM_TIPOS.map((t: ImagemTipo) => (
            <button
              key={t}
              type="button"
              onClick={() => setI({ tipo: t, regiao: "", contraste: "", detalhe: "" })}
              className={pill(imagem.tipo === t)}
            >
              {IMAGEM_TIPO_LABEL[t]}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs">
            <span className={label}>Região / estudo *</span>
            <select value={imagem.regiao} onChange={(e) => setI({ regiao: e.target.value })} className={INPUT}>
              <option value="">—</option>
              {IMAGEM_REGIOES[imagem.tipo].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          {imagemUsaContraste(imagem.tipo) && (
            <div className="block text-xs">
              <span className={label}>Contraste *</span>
              <div className="flex flex-wrap gap-3 pt-1.5">
                {(Object.keys(IMAGEM_CONTRASTE_LABEL) as Exclude<ImagemContraste, "">[]).map((k) => (
                  <label key={k} className="flex cursor-pointer items-center gap-1.5 text-sm text-zinc-700">
                    <input
                      type="radio"
                      name="imagem-contraste"
                      checked={imagem.contraste === k}
                      onChange={() => setI({ contraste: k })}
                      className="h-4 w-4 accent-brand-teal-dark"
                    />
                    {IMAGEM_CONTRASTE_LABEL[k].replace(" contraste", "")}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <label className="mt-2 block text-xs">
          <span className={label}>
            {imagem.regiao === "Outro" ? "Descreva o exame *" : "Detalhe do exame (opcional)"} ({imagem.detalhe.length}/{IMAGEM_MAX_DETALHE})
          </span>
          <input
            value={imagem.detalhe}
            maxLength={IMAGEM_MAX_DETALHE}
            onChange={(e) => setI({ detalhe: e.target.value })}
            placeholder="ex.: protocolo de epilepsia, SPECT miocárdico..."
            className={INPUT}
          />
        </label>
      </section>

      <section className="border-t border-zinc-200 pt-3">
        <p className={heading}>IV. Resumo da história clínica *</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
          <label className="block text-xs">
            <span className={label}>
              Resumo ({notes.length}/{IMAGEM_MAX_RESUMO})
            </span>
            <textarea
              value={notes}
              maxLength={IMAGEM_MAX_RESUMO}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-zinc-300 p-2 text-sm outline-none focus:border-brand-teal-dark"
            />
          </label>
          <label className="block text-xs">
            <span className={label}>CID-10 *</span>
            <input value={apac.cid} onChange={(e) => setA({ cid: e.target.value })} placeholder="Ex.: M54.4" className={INPUT} />
          </label>
        </div>
        <label className="mt-3 block text-xs">
          <span className={label}>
            Hipótese(s) diagnóstica(s) que motiva(m) a solicitação * ({imagem.hypotheses.length}/{IMAGEM_MAX_HIPOTESES})
          </span>
          <textarea
            value={imagem.hypotheses}
            maxLength={IMAGEM_MAX_HIPOTESES}
            onChange={(e) => setI({ hypotheses: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-zinc-300 p-2 text-sm outline-none focus:border-brand-teal-dark"
          />
        </label>
      </section>

      <section className="border-t border-zinc-200 pt-3">
        <p className={heading}>V. Segurança do exame</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {IMAGEM_SAFETY_ROWS.flat().map((id) => (
            <label key={id} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={imagem.safety.includes(id)}
                onChange={() => toggleSafety(id)}
                className="h-4 w-4 accent-brand-teal-dark"
              />
              {IMAGEM_SAFETY_LABEL[id]}
            </label>
          ))}
        </div>
      </section>

      <p className="text-[11px] text-zinc-500">
        A data da solicitação, o seu nome e CRM e a assinatura digital entram sozinhos no PDF.
      </p>
    </div>
  );
}
