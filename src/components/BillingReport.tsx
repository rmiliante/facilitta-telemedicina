"use client";

import type { CSSProperties } from "react";

/**
 * Relatório de faturamento (para enviar à prefeitura): consultas realizadas
 * por especialidade, valor por consulta e valor a receber, e abaixo o volume
 * de consultas por dia, uma tabela para cada especialidade. Imprime / salva
 * em PDF pelo navegador.
 */

export interface BillingData {
  periodo: { inicio: string; fim: string };
  emitidoEm: string;
  totais: { realizadas: number; valorReceber: number; semValor: number };
  especialidades: {
    name: string;
    realizadas: number;
    valorConsulta: number | null;
    valorReceber: number;
    semValor: number;
    dias: { date: string; qtd: number }[];
  }[];
}

const NAVY = "#15004d";
const TEAL = "#1f9d8a";
const MUTED = "#5b5670";
const LINE = "#ece9f1";
const SOFT = "#f4f2f9";
const PRINT = { WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" } as CSSProperties;

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const br = (iso: string) => iso.split("-").reverse().join("/");
const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const weekday = (iso: string) => WEEK[new Date(`${iso}T12:00:00Z`).getUTCDay()];

const th: CSSProperties = { textAlign: "left", fontSize: 10.5, textTransform: "uppercase", color: MUTED, borderBottom: `1.5px solid ${NAVY}`, padding: "6px 8px" };
const td: CSSProperties = { padding: "6px 8px", borderBottom: `1px solid ${LINE}`, fontSize: 12 };
const right: CSSProperties = { textAlign: "right" };
const foot: CSSProperties = { ...td, fontWeight: 700, background: SOFT, borderTop: `2px solid ${NAVY}`, borderBottom: 0, ...PRINT };
const h2: CSSProperties = { fontSize: 13, color: NAVY, margin: "20px 0 8px", textTransform: "uppercase", letterSpacing: ".04em" };

export default function BillingReport({ data, monthLabel }: { data: BillingData; monthLabel: string }) {
  const t = data.totais;
  const maxQtd = Math.max(1, ...data.especialidades.flatMap((e) => e.dias.map((d) => d.qtd)));
  return (
    <div style={{ background: "#fff", color: "#1c1730", fontFamily: "Helvetica, Arial, sans-serif", maxWidth: 794, margin: "0 auto", padding: "28px 32px" }} className="rounded-xl border border-zinc-200 print:border-0 print:p-0">
      <style>{`@media print { .bill-block { break-inside: avoid; } }`}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `2px solid ${NAVY}`, paddingBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 800, color: NAVY, fontSize: 17 }}>
            Facilitta <span style={{ color: TEAL }}>Saúde</span>
          </div>
          <h1 style={{ fontSize: 20, margin: "10px 0 0", color: NAVY }}>Relatório de faturamento</h1>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>Consultas de telemedicina realizadas · {monthLabel}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: MUTED }}>
          Emitido em {br(data.emitidoEm)}
          <br />
          Período: {br(data.periodo.inicio)} a {br(data.periodo.fim)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, margin: "16px 0 4px" }}>
        {[
          ["Cliente", "Secretaria Municipal de Saúde"],
          ["Total de consultas", String(t.realizadas)],
          ["Valor total a receber", money(t.valorReceber)],
        ].map(([k, v]) => (
          <div key={k} style={{ border: "1px solid #e4e1ea", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: MUTED }}>
            {k}
            <b style={{ display: "block", fontSize: 13, color: "#1c1730", marginTop: 2 }}>{v}</b>
          </div>
        ))}
      </div>

      <div className="bill-block">
        <h2 style={h2}>Consultas por especialidade</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Especialidade</th>
              <th style={{ ...th, ...right }}>Consultas</th>
              <th style={{ ...th, ...right }}>Valor por consulta</th>
              <th style={{ ...th, ...right }}>Valor a receber</th>
            </tr>
          </thead>
          <tbody>
            {data.especialidades.map((e) => (
              <tr key={e.name}>
                <td style={td}>{e.name}</td>
                <td style={{ ...td, ...right }}>{e.realizadas}</td>
                <td style={{ ...td, ...right }}>{e.valorConsulta === null ? "—" : money(e.valorConsulta)}</td>
                <td style={{ ...td, ...right, fontWeight: 700 }}>{money(e.valorReceber)}</td>
              </tr>
            ))}
            {data.especialidades.length === 0 && (
              <tr>
                <td style={td} colSpan={4}>
                  Nenhuma consulta realizada no período.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td style={foot}>Total</td>
              <td style={{ ...foot, ...right }}>{t.realizadas}</td>
              <td style={foot}></td>
              <td style={{ ...foot, ...right }}>{money(t.valorReceber)}</td>
            </tr>
          </tfoot>
        </table>
        {t.semValor > 0 && (
          <p style={{ fontSize: 10.5, color: "#b45309", marginTop: 6 }}>
            {t.semValor} consulta(s) sem valor no cadastro do médico: não entram no valor a receber.
          </p>
        )}
      </div>

      <h2 style={{ ...h2, marginBottom: 0 }}>Volume de consultas por dia realizado</h2>
      <div style={{ fontSize: 11, color: MUTED }}>Por especialidade</div>
      {data.especialidades.map((e) => (
        <div key={e.name} className="bill-block">
          <h2 style={{ ...h2, marginTop: 18 }}>{e.name}</h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, width: "26%" }}>Dia</th>
                <th style={{ ...th, width: "14%" }}>Semana</th>
                <th style={{ ...th, ...right, width: "16%" }}>Consultas</th>
                <th style={th}>Volume</th>
              </tr>
            </thead>
            <tbody>
              {e.dias.map((d) => (
                <tr key={d.date}>
                  <td style={td}>{br(d.date)}</td>
                  <td style={td}>{weekday(d.date)}</td>
                  <td style={{ ...td, ...right, fontWeight: 700 }}>{d.qtd}</td>
                  <td style={td}>
                    <div style={{ height: 9, width: `${Math.round((d.qtd / maxQtd) * 100)}%`, background: TEAL, borderRadius: 3, ...PRINT }} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={foot}>Total ({e.dias.length} {e.dias.length === 1 ? "dia" : "dias"})</td>
                <td style={foot}></td>
                <td style={{ ...foot, ...right }}>{e.realizadas}</td>
                <td style={foot}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      ))}

      <p style={{ fontSize: 10.5, color: MUTED, marginTop: 18 }}>
        <b>Total geral: {t.realizadas} consultas · {money(t.valorReceber)}.</b> Consideradas apenas as consultas realizadas (paciente presente). Valores conforme contrato vigente.
      </p>
      <p style={{ fontSize: 9.5, color: "#8a85a0", marginTop: 14 }}>Facilitta Saúde · facilittasaude.com.br</p>
    </div>
  );
}
