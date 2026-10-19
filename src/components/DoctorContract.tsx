"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CONTRATO_MINUTA } from "@/lib/contratoMinuta";

type Doc = {
  id: string;
  name: string;
  cpf?: string | null;
  crm?: string | null;
  crm_uf?: string | null;
  rqe?: string | null;
  consult_fee?: number | string | null;
  specialties?: { name: string } | { name: string }[] | null;
};

const CONTRATANTE = {
  nome: "FACILITTA SAÚDE E TECNOLOGIA LTDA.",
  cnpj: "59.645.429/0001-89",
  sede: "Rua Capitão Antônio Rosa, nº 409, Jardim Paulista, São Paulo/SP, CEP 01443-010",
};

const UN = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DZ = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CT = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function ate999(n: number): string {
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const parts: string[] = [];
  if (c) parts.push(CT[c]);
  if (r) parts.push(r < 20 ? UN[r] : DZ[Math.floor(r / 10)] + (r % 10 ? " e " + UN[r % 10] : ""));
  return parts.join(" e ");
}

function inteiroExtenso(n: number): string {
  if (n === 0) return "zero";
  const mil = Math.floor(n / 1000);
  const r = n % 1000;
  const parts: string[] = [];
  if (mil) parts.push(mil === 1 ? "mil" : ate999(mil) + " mil");
  if (r) parts.push(ate999(r));
  return parts.join(r && (r < 100 || r % 100 === 0) ? " e " : " ");
}

export function valorExtenso(v: number): string {
  const cents = Math.round(v * 100);
  const reais = Math.floor(cents / 100);
  const cent = cents % 100;
  const partes: string[] = [];
  if (reais) partes.push(inteiroExtenso(reais) + (reais === 1 ? " real" : " reais"));
  if (cent) partes.push(inteiroExtenso(cent) + (cent === 1 ? " centavo" : " centavos"));
  return partes.join(" e ") || "zero real";
}

function parseValor(s: string | number | null | undefined): number {
  if (s === null || s === undefined || s === "") return 0;
  const n = typeof s === "number" ? s : parseFloat(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function especialidadeDe(d: Doc | undefined): string {
  const s = d?.specialties;
  if (!s) return "";
  return (Array.isArray(s) ? s[0]?.name : s.name) || "";
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

type Dados = {
  razao: string;
  cnpj: string;
  cep: string;
  endereco: string;
  repNome: string;
  repCpf: string;
  cidade: string;
  data: string; // yyyy-mm-dd
  valor: string;
};

export function montarContratoHtml(doc: Doc, d: Dados, logoUrl: string, destaque: boolean): string {
  const esp = especialidadeDe(doc);
  const espLower = esp.toLowerCase();
  const falta = (v: string, rotulo: string) =>
    v.trim() ? `<b>${esc(v.trim())}</b>` : destaque ? `<span class="falta">[${rotulo}]</span>` : `<b>[${rotulo}]</b>`;
  const valorNum = parseValor(d.valor);
  const valorTxt = valorNum > 0 ? `${fmtBRL(valorNum)} (${valorExtenso(valorNum)})` : "R$ ____";
  const crm = doc.crm ? `CRM/${doc.crm_uf || "__"} nº ${doc.crm}` : "CRM nº ____";
  const medico = `${doc.name}, ${crm}${doc.rqe ? `, RQE nº ${doc.rqe}` : ""}`;

  const subst = (t: string) =>
    esc(t)
      .replace(/\{\{ESP_CAP\}\}/g, esc(esp || "____"))
      .replace(/\{\{ESP\}\}/g, esc(espLower || "____"))
      .replace(/\{\{MEDICO\}\}/g, `<b>${esc(medico)}</b>`)
      .replace(/\{\{VALOR\}\}/g, `<b>${esc(valorTxt)}</b>`);

  let dataTxt = "____ de ____________________ de 2026";
  if (d.data) {
    const [y, m, dd] = d.data.split("-").map(Number);
    if (y && m && dd) dataTxt = `${dd} de ${MESES[m - 1]} de ${y}`;
  }
  const cidade = d.cidade.trim() || "São Paulo/SP";
  const titulo = `CONTRATO DE PRESTAÇÃO DE SERVIÇOS MÉDICOS${esp ? ` EM ${esp.toUpperCase()}` : ""}`;

  const preambulo1 = `Pelo presente instrumento particular, de um lado, <b>${CONTRATANTE.nome}</b>, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº ${CONTRATANTE.cnpj}, com sede na ${CONTRATANTE.sede}, neste ato representada na forma de seu contrato social, doravante denominada simplesmente <b>CONTRATANTE</b>;`;
  const preambulo2 = `e, de outro lado, ${falta(d.razao, "razão social")}, pessoa jurídica de direito privado, inscrita no CNPJ/MF sob o nº ${falta(d.cnpj, "CNPJ")}, com sede na ${falta(d.endereco, "endereço da sede")}${d.cep.trim() ? `, CEP ${esc(d.cep.trim())}` : ""}, neste ato representada por ${falta(d.repNome, "representante")}${d.repCpf.trim() ? `, CPF nº ${esc(d.repCpf.trim())}` : ""}, doravante denominada simplesmente <b>CONTRATADA</b>;`;

  const clausulas = CONTRATO_MINUTA.clauses
    .map((c) => `<h2>${esc(c.h)}</h2>${c.p.map((p) => `<p>${subst(p)}</p>`).join("")}`)
    .join("");

  const assin = (titulo: string, nome: string, extra: string) =>
    `<div class="ass"><div class="linha"></div><b>${titulo}</b><br>${nome}<br><span class="peq">${extra}</span></div>`;

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
<style>
@page { size: A4; margin: 22mm 20mm 20mm 20mm;
  @bottom-left { content: "Facilitta Saúde e Tecnologia Ltda. · Contrato de Prestação de Serviços Médicos"; font: 7.5pt Arial, sans-serif; color: #64748b; }
  @bottom-right { content: "Página " counter(page) " de " counter(pages); font: 7.5pt Arial, sans-serif; color: #64748b; } }
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; line-height: 1.5; color: #111827; margin: 0; }
.cab { display: flex; align-items: center; gap: 12px; border-bottom: 2.5px solid #00e2c3; padding-bottom: 10px; margin-bottom: 20px; }
.cab img { width: 52px; height: 52px; border-radius: 10px; }
.cab .marca { font-size: 22pt; font-weight: bold; color: #15004d; line-height: 1; }
.cab .marca span { color: #009594; }
.cab .sub { font-size: 8pt; color: #64748b; margin-top: 4px; }
h1 { text-align: center; font-size: 13pt; color: #15004d; margin: 0 0 18px; letter-spacing: .3px; }
h2 { text-align: center; font-size: 10pt; color: #15004d; margin: 18px 0 6px; page-break-after: avoid; }
p { text-align: justify; margin: 0 0 6px; }
.falta { background: #fef08a; color: #854d0e; padding: 0 2px; }
.data { margin: 22px 0 8px; }
.assinaturas { display: flex; gap: 40px; margin-top: 46px; page-break-inside: avoid; }
.testemunhas { display: flex; gap: 40px; margin-top: 40px; page-break-inside: avoid; }
.ass { flex: 1; text-align: center; font-size: 9pt; }
.ass .linha { border-top: 1px solid #111827; margin-bottom: 4px; }
.peq { font-size: 8pt; color: #475569; }
.test { flex: 1; font-size: 9pt; }
.test .linha { border-top: 1px solid #111827; margin-bottom: 4px; }
</style></head><body>
<div class="cab"><img src="${logoUrl}" alt="Facilitta"><div><div class="marca">facilitta <span>saúde</span></div><div class="sub">${CONTRATANTE.nome} · CNPJ ${CONTRATANTE.cnpj}</div></div></div>
<h1>${esc(titulo)}</h1>
<p>${preambulo1}</p>
<p>${preambulo2}</p>
<p>${esc(CONTRATO_MINUTA.intro3)}</p>
${clausulas}
<p class="data">E, por estarem justas e contratadas, as partes assinam o presente instrumento, por meio físico ou eletrônico, juntamente com duas testemunhas.</p>
<p class="data">${esc(cidade)}, ${esc(dataTxt)}.</p>
<div class="assinaturas">
${assin("CONTRATANTE", CONTRATANTE.nome, "CNPJ " + CONTRATANTE.cnpj)}
${assin("CONTRATADA", d.razao.trim() ? esc(d.razao.trim()) : "[razão social]", "CNPJ " + (d.cnpj.trim() ? esc(d.cnpj.trim()) : "[CNPJ]") + (d.repNome.trim() ? "<br>p. " + esc(d.repNome.trim()) : ""))}
</div>
<div class="testemunhas">
<div class="test"><div class="linha"></div>Testemunha 1<br>Nome:<br>CPF:</div>
<div class="test"><div class="linha"></div>Testemunha 2<br>Nome:<br>CPF:</div>
</div>
</body></html>`;
}

const inputCls = "w-full rounded-md border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark";

export default function DoctorContract({ doctors, initialId, onClose }: { doctors: Doc[]; initialId: string; onClose: () => void }) {
  const [doctorId, setDoctorId] = useState(initialId);
  const doc = doctors.find((x) => x.id === doctorId);
  const [d, setD] = useState<Dados>({ razao: "", cnpj: "", cep: "", endereco: "", repNome: "", repCpf: "", cidade: "São Paulo/SP", data: "", valor: "" });
  const loaded = useRef<string>("");

  // carrega rascunho salvo neste navegador + valor do cadastro
  useEffect(() => {
    if (!doc || loaded.current === doc.id) return;
    loaded.current = doc.id;
    let saved: Partial<Dados> = {};
    try {
      const raw = localStorage.getItem("contrato-medico:" + doc.id);
      if (raw) saved = JSON.parse(raw);
    } catch {}
    const fee = parseValor(doc.consult_fee);
    const t = setTimeout(
      () =>
        setD({
          razao: "",
          cnpj: "",
          cep: "",
          endereco: "",
          repNome: doc.name,
          repCpf: doc.cpf || "",
          cidade: "São Paulo/SP",
          data: "",
          valor: fee ? fee.toFixed(2).replace(".", ",") : "",
          ...saved,
        }),
      0,
    );
    return () => clearTimeout(t);
  }, [doc]);

  useEffect(() => {
    if (!doc || loaded.current !== doc.id) return;
    try {
      localStorage.setItem("contrato-medico:" + doc.id, JSON.stringify(d));
    } catch {}
  }, [d, doc]);

  const logoUrl = typeof window !== "undefined" ? window.location.origin + "/icon-facilitta.png" : "/icon-facilitta.png";
  const html = useMemo(() => (doc ? montarContratoHtml(doc, d, logoUrl, true) : ""), [doc, d, logoUrl]);
  const valorNum = parseValor(d.valor);

  const faltas: string[] = [];
  if (!doc) faltas.push("médico");
  else {
    if (!especialidadeDe(doc)) faltas.push("especialidade do médico (cadastro)");
    if (!doc.crm) faltas.push("CRM do médico (cadastro)");
  }
  if (valorNum <= 0) faltas.push("valor por consulta");
  if (!d.razao.trim()) faltas.push("razão social");
  if (!d.cnpj.trim()) faltas.push("CNPJ");
  if (!d.endereco.trim()) faltas.push("endereço da sede");
  if (!d.repNome.trim()) faltas.push("representante");

  function set<K extends keyof Dados>(k: K, v: string) {
    setD((x) => ({ ...x, [k]: v }));
  }

  function imprimir() {
    if (!doc) return;
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    f.srcdoc = montarContratoHtml(doc, d, logoUrl, false);
    f.onload = () => {
      f.contentWindow?.focus();
      f.contentWindow?.print();
      setTimeout(() => f.remove(), 60000);
    };
    document.body.appendChild(f);
  }

  function baixarWord() {
    if (!doc) return;
    const h = montarContratoHtml(doc, d, logoUrl, false).replace("<html ", '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" ');
    const blob = new Blob(["﻿", h], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Contrato - ${doc.name}.doc`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-100">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-facilitta.png" alt="" className="h-7 w-7 rounded-md" />
          <div>
            <p className="text-[11px] text-zinc-400">Médicos › Contrato de prestação de serviços</p>
            <h2 className="text-base font-bold text-brand-navy">Gerar contrato médico</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={baixarWord} disabled={!doc} className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
            Baixar Word (.doc)
          </button>
          <button onClick={imprimir} disabled={!doc} className="rounded-md bg-brand-teal-dark px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
            Imprimir / Salvar PDF
          </button>
          <button onClick={onClose} className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50">
            Fechar
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3 lg:flex-row">
        <div className="w-full shrink-0 space-y-4 rounded-xl border border-zinc-200 bg-white p-4 text-xs lg:w-[400px] lg:overflow-auto">
          <section>
            <h3 className="mb-2 text-sm font-bold text-brand-navy">1 · Médico (do cadastro)</h3>
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={inputCls}>
              {doctors.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-md bg-zinc-100 p-2">
                <span className="text-zinc-500">Especialidade</span>
                <br />
                {especialidadeDe(doc) || "—"}
              </div>
              <div className="rounded-md bg-zinc-100 p-2">
                <span className="text-zinc-500">CRM / RQE</span>
                <br />
                {doc?.crm ? `${doc.crm}/${doc.crm_uf || ""}` : "—"} · {doc?.rqe || "—"}
              </div>
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-bold text-brand-navy">2 · Valor por consulta</h3>
            <div className="flex gap-2">
              <input value={d.valor} onChange={(e) => set("valor", e.target.value)} inputMode="decimal" placeholder="70,00" className={inputCls + " max-w-[110px]"} />
              <div className="flex-1 rounded-md bg-zinc-100 p-2 text-zinc-600">{valorNum > 0 ? valorExtenso(valorNum) : "informe o valor"}</div>
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">Vem do cadastro: “valor que o médico recebe por consulta”.</p>
          </section>
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-brand-navy">3 · CONTRATADA (pessoa jurídica do médico)</h3>
            <input value={d.razao} onChange={(e) => set("razao", e.target.value)} placeholder="Razão social" className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <input value={d.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="CNPJ" className={inputCls} />
              <input value={d.cep} onChange={(e) => set("cep", e.target.value)} placeholder="CEP" className={inputCls} />
            </div>
            <input value={d.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Endereço da sede (rua, nº, bairro, cidade/UF)" className={inputCls} />
            <div className="grid grid-cols-[2fr_1fr] gap-2">
              <input value={d.repNome} onChange={(e) => set("repNome", e.target.value)} placeholder="Representante" className={inputCls} />
              <input value={d.repCpf} onChange={(e) => set("repCpf", e.target.value)} placeholder="CPF" className={inputCls} />
            </div>
          </section>
          <section>
            <h3 className="mb-2 text-sm font-bold text-brand-navy">4 · Assinatura</h3>
            <div className="grid grid-cols-2 gap-2">
              <input value={d.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="Cidade/UF" className={inputCls} />
              <input type="date" value={d.data} onChange={(e) => set("data", e.target.value)} className={inputCls} />
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">Sem data, o contrato sai com a data em branco para preencher à mão.</p>
          </section>
          {faltas.length === 0 ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">✔ Campos obrigatórios completos. O contrato é atualizado ao lado em tempo real.</div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800">Falta preencher: {faltas.join(", ")}. (Em amarelo no contrato.)</div>
          )}
          <p className="text-[11px] text-zinc-400">Os dados da CONTRATADA ficam salvos neste navegador para o próximo contrato do mesmo médico. Revise o texto com seu advogado antes de assinar.</p>
        </div>
        <div className="min-h-[70vh] flex-1 overflow-hidden rounded-xl bg-zinc-300 p-3">
          <iframe title="Prévia do contrato" srcDoc={html} className="mx-auto h-full w-full max-w-[820px] rounded bg-white shadow-lg" style={{ minHeight: "70vh" }} />
        </div>
      </div>
    </div>
  );
}
