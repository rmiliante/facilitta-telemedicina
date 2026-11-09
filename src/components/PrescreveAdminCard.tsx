"use client";

import { useEffect, useState } from "react";

interface Medico {
  id: string;
  name: string;
  crm: string | null;
  vinculado: boolean;
  validadoEm: string | null;
  conectado: boolean | null;
  mes: number;
  total: number;
}
interface Recente {
  id: string;
  medico: string;
  paciente: string;
  tipo: string;
  numero: string | null;
  status: string;
  quando: string;
}
interface Dados {
  ativo: boolean;
  medicos?: Medico[];
  recentes?: Recente[];
  emitidosNoMes?: number;
  limiteMensal?: number;
}

function quando(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function PrescreveAdminCard() {
  const [d, setD] = useState<Dados | null>(null);

  useEffect(() => {
    fetch("/api/admin/prescreve")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setD(j))
      .catch(() => setD(null));
  }, []);

  if (!d || !d.ativo || !d.medicos) return null;
  const usado = d.emitidosNoMes ?? 0;
  const limite = d.limiteMensal ?? 500;
  const pct = Math.min(100, Math.round((usado / limite) * 100));

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-brand-navy">Receitas controladas (Prescreve)</h3>
          <p className="text-xs text-zinc-500">Quem vinculou a conta, quem está com o certificado conectado e o que foi emitido.</p>
          <a href="/manuais/guia-receita-controlada.pdf" target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold text-brand-teal-dark underline">
            Manual das médicas (PDF)
          </a>
        </div>
        <div className="text-right text-xs text-zinc-600">
          <p>{usado} de {limite} documentos no mês</p>
          <div className="mt-1 h-1.5 w-40 rounded-full bg-zinc-200">
            <div className={"h-1.5 rounded-full " + (pct >= 90 ? "bg-red-500" : "bg-brand-teal")} style={{ width: pct + "%" }} />
          </div>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500">
              <th className="py-1.5 pr-3 font-medium">Médico</th>
              <th className="py-1.5 pr-3 font-medium">CRM</th>
              <th className="py-1.5 pr-3 font-medium">Conta Prescreve</th>
              <th className="py-1.5 pr-3 font-medium">Certificado</th>
              <th className="py-1.5 pr-3 font-medium">No mês</th>
              <th className="py-1.5 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {d.medicos.map((m) => (
              <tr key={m.id} className="border-b border-zinc-100">
                <td className="py-1.5 pr-3 font-medium text-zinc-800">{m.name}</td>
                <td className="py-1.5 pr-3 text-zinc-600">{m.crm || "—"}</td>
                <td className="py-1.5 pr-3">
                  <span className={"rounded-full px-2 py-0.5 " + (m.vinculado ? "bg-emerald-100 text-emerald-800" : "bg-zinc-100 text-zinc-600")}>
                    {m.vinculado ? "Vinculada" : "Não vinculada"}
                  </span>
                </td>
                <td className="py-1.5 pr-3">
                  {m.conectado === null ? (
                    <span className="text-zinc-400">—</span>
                  ) : (
                    <span className={"rounded-full px-2 py-0.5 " + (m.conectado ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800")}>
                      {m.conectado ? "Conectado" : "Desconectado"}
                    </span>
                  )}
                </td>
                <td className="py-1.5 pr-3">{m.mes}</td>
                <td className="py-1.5">{m.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="mt-4 text-xs font-semibold text-zinc-700">Últimas emissões</h4>
      {d.recentes && d.recentes.length > 0 ? (
        <ul className="mt-1 divide-y divide-zinc-100 text-xs">
          {d.recentes.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span className="text-zinc-700">{r.medico} · {r.paciente}</span>
              <span className="text-zinc-500">{r.tipo}{r.numero ? " · Nº " + r.numero : ""} · {quando(r.quando)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-zinc-500">Nenhuma receita controlada emitida ainda.</p>
      )}
      <p className="mt-3 text-[11px] text-zinc-400">O saldo de numeração SNCR é de cada médico e só ele consegue ver (na tela da receita).</p>
    </div>
  );
}
