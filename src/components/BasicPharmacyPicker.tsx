"use client";

import { useMemo, useState } from "react";
import {
  BASIC_AREAS,
  BASIC_MEDS,
  BASIC_PLACES,
  FORMA_GROUPS,
  basicClasses,
  filterBasicMeds,
  medLabel,
  type BasicPlace,
  type FormaGroup,
} from "@/lib/basicPharmacy";

const PLACE_TONE: Record<BasicPlace, string> = {
  "Farmácia Básica": "bg-green-100 text-green-800",
  USF: "bg-blue-100 text-blue-800",
  NAPS: "bg-amber-100 text-amber-800",
  UBS: "bg-violet-100 text-violet-800",
};

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
        on ? "border-brand-navy bg-brand-navy text-white" : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Lista dos medicamentos ofertados pela Atenção Básica de Jacobina, com busca e filtros
 * (onde está disponível, área, classe e forma). Clicar num item devolve o texto pro campo Medicamento.
 */
export default function BasicPharmacyPicker({ onPick }: { onPick: (label: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [place, setPlace] = useState<BasicPlace | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [classe, setClasse] = useState<string | null>(null);
  const [forma, setForma] = useState<FormaGroup | null>(null);

  const results = useMemo(() => filterBasicMeds({ q, place, area, classe, forma }), [q, place, area, classe, forma]);
  const classes = useMemo(() => basicClasses(area), [area]);
  const title = "text-[10px] font-bold uppercase tracking-wide text-zinc-500";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-brand-teal-dark px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
      >
        Medicamentos da Atenção Básica
      </button>
    );
  }

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-brand-teal-dark">
      <div className="flex items-center justify-between bg-brand-teal-dark px-3 py-1.5 text-xs font-bold text-white">
        <span>Medicamentos da Atenção Básica · Jacobina</span>
        <span className="flex items-center gap-3 font-normal">
          {BASIC_MEDS.length} itens
          <button type="button" onClick={() => setOpen(false)} className="font-semibold underline">
            Fechar
          </button>
        </span>
      </div>
      <div className="space-y-2 bg-teal-50/60 p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar: ex. losartana, antibiótico, xarope…"
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-brand-teal-dark"
        />
        <div>
          <p className={title}>Onde está disponível</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Chip on={place === null} onClick={() => setPlace(null)}>Todos</Chip>
            {BASIC_PLACES.map((p) => (
              <Chip key={p} on={place === p} onClick={() => setPlace(place === p ? null : p)}>
                {p === "NAPS" ? "NAPS (saúde mental)" : p}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className={title}>Área</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Chip on={area === null} onClick={() => { setArea(null); setClasse(null); }}>Todas</Chip>
            {BASIC_AREAS.map((a) => (
              <Chip key={a} on={area === a} onClick={() => { setArea(area === a ? null : a); setClasse(null); }}>
                {a}
              </Chip>
            ))}
          </div>
        </div>
        {area && (
          <div>
            <p className={title}>Classe · {area}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <Chip on={classe === null} onClick={() => setClasse(null)}>Todas</Chip>
              {classes.map((c) => (
                <Chip key={c} on={classe === c} onClick={() => setClasse(classe === c ? null : c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <div>
          <p className={title}>Forma</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Chip on={forma === null} onClick={() => setForma(null)}>Todas</Chip>
            {FORMA_GROUPS.map((f) => (
              <Chip key={f} on={forma === f} onClick={() => setForma(forma === f ? null : f)}>
                {f}
              </Chip>
            ))}
          </div>
        </div>
      </div>
      <p className="border-t border-zinc-100 bg-white px-3 py-1.5 text-[11px] text-zinc-500">
        {results.length} {results.length === 1 ? "resultado" : "resultados"} · clique para colocar na receita
      </p>
      <ul className="max-h-72 overflow-y-auto bg-white">
        {results.map((m, i) => (
          <li key={`${m.nome}-${m.conc}-${m.forma}-${i}`} className="border-t border-zinc-100">
            <button
              type="button"
              onClick={() => {
                onPick(medLabel(m));
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-brand-teal/15"
            >
              <span className="text-sm text-zinc-800">
                <b>{m.nome}</b> {m.conc}
                {m.forma && <span className="text-zinc-500"> · {m.forma}</span>}
                <span className="block text-[10px] text-zinc-400">
                  {m.classe}
                  {m.controlled ? " · receita controlada" : ""}
                </span>
              </span>
              <span className="flex shrink-0 flex-wrap justify-end gap-1">
                {m.where.map((w) => (
                  <span key={w} className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PLACE_TONE[w]}`}>
                    {w}
                  </span>
                ))}
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 && <li className="px-3 py-3 text-xs text-zinc-500">Nenhum medicamento com esses filtros.</li>}
      </ul>
    </div>
  );
}
