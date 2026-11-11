"use client";

import { useState } from "react";

export type Endereco = {
  cep: string;
  address: string;
  addressNumber: string;
  addressComplement: string;
  neighborhood: string;
  city: string;
  state: string;
};

export const ENDERECO_VAZIO: Endereco = {
  cep: "",
  address: "",
  addressNumber: "",
  addressComplement: "",
  neighborhood: "",
  city: "",
  state: "",
};

function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
}

/** Endereço completo do paciente. O CEP preenche rua, bairro, cidade e UF (ViaCEP). */
export default function AddressFields({
  value,
  onChange,
  labelCls = "mb-1 mt-3 block text-xs font-semibold text-slate-600",
  inputCls = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm",
}: {
  value: Endereco;
  onChange: (v: Endereco) => void;
  labelCls?: string;
  inputCls?: string;
}) {
  const [msg, setMsg] = useState("");
  const set = (k: keyof Endereco, v: string) => onChange({ ...value, [k]: v });

  async function buscarCep(cepMasked: string) {
    const d = cepMasked.replace(/\D/g, "");
    if (d.length !== 8) return setMsg("");
    setMsg("Buscando endereço…");
    try {
      const r = await fetch("https://viacep.com.br/ws/" + d + "/json/");
      const j = await r.json();
      if (j.erro) return setMsg("CEP não encontrado. Preencha o endereço manualmente.");
      onChange({
        ...value,
        cep: cepMasked,
        address: value.address || j.logradouro || "",
        neighborhood: value.neighborhood || j.bairro || "",
        city: value.city || j.localidade || "",
        state: value.state || j.uf || "",
      });
      setMsg("✓ Endereço preenchido pelo CEP");
    } catch {
      setMsg("Não foi possível buscar o CEP. Preencha manualmente.");
    }
  }

  return (
    <div>
      <p className="mt-5 border-t border-slate-200 pt-3 text-sm font-bold text-slate-700">Endereço</p>
      <div className="grid gap-x-4 sm:grid-cols-[140px_1fr_110px]">
        <div>
          <label className={labelCls}>CEP</label>
          <input
            className={inputCls}
            inputMode="numeric"
            placeholder="00000-000"
            value={value.cep}
            onChange={(e) => {
              const m = maskCep(e.target.value);
              set("cep", m);
              if (m.replace(/\D/g, "").length === 8) void buscarCep(m);
            }}
          />
          {msg && <p className="mt-1 text-xs text-slate-500">{msg}</p>}
        </div>
        <div>
          <label className={labelCls}>Rua / Logradouro</label>
          <input className={inputCls} value={value.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Número</label>
          <input className={inputCls} value={value.addressNumber} onChange={(e) => set("addressNumber", e.target.value)} />
        </div>
      </div>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Complemento</label>
          <input className={inputCls} value={value.addressComplement} onChange={(e) => set("addressComplement", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>Bairro</label>
          <input className={inputCls} value={value.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} />
        </div>
      </div>
      <div className="grid gap-x-4 sm:grid-cols-[1fr_90px]">
        <div>
          <label className={labelCls}>Cidade</label>
          <input className={inputCls} value={value.city} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div>
          <label className={labelCls}>UF</label>
          <input className={inputCls} maxLength={2} value={value.state} onChange={(e) => set("state", e.target.value.toUpperCase())} />
        </div>
      </div>
    </div>
  );
}
