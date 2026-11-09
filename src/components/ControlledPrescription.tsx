"use client";

import { useEffect, useRef, useState } from "react";
import type { IssuedDocument } from "@/components/PrescriptionPanel";

/**
 * Receita controlada (azul, amarela, controle especial) pela API de Prescrições da
 * Prescreve, com numeração SNCR do médico. Só aparece quando a flag
 * PRESCREVE_PRESCRICOES_ATIVO está ligada no servidor.
 */

interface Conta {
  ativo: boolean;
  cpfOk?: boolean;
  vinculado?: boolean;
  conectado?: boolean;
  emailPadrao?: string | null;
  provider?: string | null;
}

const TIPOS: { id: string; label: string; grupo: string }[] = [
  { id: "B1", label: "Notificação AZUL (B1)", grupo: "Azul" },
  { id: "B2", label: "Notificação AZUL (B2)", grupo: "Azul" },
  { id: "A1", label: "Notificação AMARELA (A1)", grupo: "Amarela" },
  { id: "A2", label: "Notificação AMARELA (A2)", grupo: "Amarela" },
  { id: "A3", label: "Notificação AMARELA (A3)", grupo: "Amarela" },
  { id: "C1", label: "Controle especial (C1)", grupo: "Especial" },
  { id: "C5", label: "Controle especial (C5)", grupo: "Especial" },
  { id: "C2", label: "Retinoides (C2)", grupo: "Especial" },
  { id: "antimicrobiana", label: "Antimicrobiano", grupo: "Retenção" },
  { id: "GLP1", label: "GLP-1", grupo: "Retenção" },
];

const NOMES_SALDO: Record<string, string> = {
  NRA: "Amarela", NRB: "Azul B1", NRB2: "Azul B2", NRR: "Retinoides", NRT: "Talidomida", RCE: "Especial", RET: "Retenção",
};

async function api(body: Record<string, unknown>) {
  const res = await fetch("/api/doctor/prescreve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) return { ok: false, error: "Sem conexão. Tente de novo." } as Record<string, unknown>;
  return (await res.json().catch(() => ({ error: "Resposta inválida" }))) as Record<string, unknown>;
}

const input = "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-brand-teal";
const btn = "rounded-md px-3 py-2 text-xs font-semibold disabled:opacity-50";

export default function ControlledPrescription({
  appointmentId,
  onIssued,
}: {
  appointmentId: string;
  onIssued: (doc: IssuedDocument) => void;
}) {
  const [conta, setConta] = useState<Conta | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [modoSncr, setModoSncr] = useState(false);
  const [saldo, setSaldo] = useState<Record<string, number> | null>(null);
  const [sncrUrl, setSncrUrl] = useState<string | null>(null);
  const [otpBird, setOtpBird] = useState("");
  const [esperandoApp, setEsperandoApp] = useState(false);
  const cancelPoll = useRef(false);

  const [tipo, setTipo] = useState("B1");
  const [nome, setNome] = useState("");
  const [conc, setConc] = useState("");
  const [forma, setForma] = useState("");
  const [qtd, setQtd] = useState("");
  const [obs, setObs] = useState("");
  const [emitido, setEmitido] = useState<string | null>(null);

  async function carregar() {
    const res = await fetch("/api/doctor/prescreve").catch(() => null);
    if (!res || !res.ok) return setConta({ ativo: false });
    const c = (await res.json()) as Conta;
    setConta(c);
    if (c.emailPadrao && !email) setEmail(c.emailPadrao);
  }
  useEffect(() => {
    carregar();
    return () => { cancelPoll.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!conta || !conta.ativo) return null;

  const pronto = !!conta.vinculado && !!conta.conectado;
  const status = !conta.vinculado ? "Conta não vinculada" : !conta.conectado ? "Certificado desconectado" : "Pronto para assinar";
  const corStatus = pronto ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800";

  async function pedirCodigo() {
    setBusy(true); setErro(null); setInfo(null);
    const r = await api({ action: "otp_pedir", email });
    setBusy(false);
    if (r.ok) { setCodigoEnviado(true); setInfo("Enviamos um código para " + String(r.email) + "."); }
    else setErro(String(r.error || "Falha ao enviar o código"));
  }
  async function validarCodigo() {
    setBusy(true); setErro(null); setInfo(null);
    const r = await api({ action: "otp_validar", email, codigo, pedirLink: modoSncr });
    setBusy(false);
    if (!r.ok) return setErro(String(r.error || "Código inválido"));
    setSaldo((r.saldo as Record<string, number>) || null);
    setSncrUrl((r.sncrUrl as string) || null);
    setCodigo(""); setCodigoEnviado(false);
    setInfo("Conta confirmada.");
    carregar();
  }
  async function conectarBird() {
    setBusy(true); setErro(null);
    const r = await api({ action: "certificado", provider: "birdid", senha: otpBird });
    setBusy(false); setOtpBird("");
    if (r.ok) { setInfo("Certificado conectado por 8 horas."); carregar(); }
    else setErro(String(r.error || "Não foi possível conectar"));
  }
  async function conectarVidaas() {
    setBusy(true); setErro(null); setInfo(null);
    const r = await api({ action: "vidaas_iniciar" });
    if (!r.ok || !r.code) { setBusy(false); return setErro(String(r.error || "Não foi possível pedir a aprovação")); }
    setBusy(false); setEsperandoApp(true); cancelPoll.current = false;
    setInfo("Abra o app VIDaaS no celular e aprove o pedido.");
    for (let i = 0; i < 40 && !cancelPoll.current; i++) {
      const s = await api({ action: "vidaas_aguardar", code: r.code });
      if (s.ok && s.conectado) { setEsperandoApp(false); setInfo("Certificado conectado por 8 horas."); carregar(); return; }
      if (!s.ok && s.error) { setEsperandoApp(false); return setErro(String(s.error)); }
      await new Promise((ok) => setTimeout(ok, 3000));
    }
    setEsperandoApp(false);
    if (!cancelPoll.current) setErro("Tempo esgotado sem aprovação no app. Tente de novo.");
  }

  async function emitir(dryRun: boolean) {
    setBusy(true); setErro(null); setInfo(null); setEmitido(null);
    const res = await fetch("/api/doctor/appointments/" + appointmentId + "/prescription-controlada", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipoControle: tipo,
        medicamentos: [{ name: nome, quantidade: qtd, concentracao: conc, forma }],
        informacoes: obs,
        dryRun,
      }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : { error: "Sem conexão. Tente de novo." };
    setBusy(false);
    if (!res || !res.ok) return setErro(String(data.error || "Falha ao emitir"));
    if (dryRun) return setInfo("Tudo certo: a receita passou na validação. Nada foi emitido nem gasto.");
    const docs = (data.documentos || []) as { numeroSncr: string | null; document: IssuedDocument | null }[];
    for (const d of docs) if (d.document) onIssued(d.document);
    setEmitido(docs.map((d) => d.numeroSncr).filter(Boolean).join(", ") || "emitida");
    setNome(""); setConc(""); setForma(""); setQtd(""); setObs("");
  }

  const mostrarOtp = !conta.vinculado || modoSncr;

  return (
    <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen(!open)} className="text-left text-sm font-semibold text-brand-navy">
          Receita controlada (azul / amarela / especial)
        </button>
        <span className={"rounded-full px-2 py-0.5 text-[11px] font-medium " + corStatus}>{status}</span>
      </div>

      {open && (
        <div className="mt-3 space-y-3 text-sm">
          {!conta.cpfOk && (
            <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">Falta o seu CPF no cadastro. Peça à administração para completar.</p>
          )}

          {mostrarOtp && conta.cpfOk && (
            <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-3">
              <p className="text-xs text-zinc-600">
                {modoSncr
                  ? "Para ver sua numeração SNCR ou pedir mais, confirme sua conta com um código enviado por e-mail."
                  : "Vincule sua conta da Prescreve. Enviamos um código para o e-mail do seu cadastro lá (a Facilitta não guarda senha)."}
              </p>
              <input className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail do cadastro na Prescreve" disabled={codigoEnviado} />
              {!codigoEnviado ? (
                <button type="button" disabled={busy || !email} onClick={pedirCodigo} className={btn + " bg-brand-navy text-white"}>Enviar código</button>
              ) : (
                <div className="flex gap-2">
                  <input className={input} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código recebido" inputMode="numeric" />
                  <button type="button" disabled={busy || !codigo} onClick={validarCodigo} className={btn + " bg-brand-teal text-white"}>Confirmar</button>
                </div>
              )}
            </div>
          )}

          {conta.vinculado && !modoSncr && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setModoSncr(true); setCodigoEnviado(false); setSaldo(null); setSncrUrl(null); }} className={btn + " border border-zinc-300 bg-white text-zinc-700"}>
                Numeração SNCR
              </button>
              {conta.conectado && (
                <button type="button" disabled={busy} onClick={async () => { await api({ action: "encerrar" }); carregar(); }} className={btn + " border border-zinc-300 bg-white text-zinc-700"}>
                  Encerrar sessão do certificado
                </button>
              )}
            </div>
          )}

          {saldo && (
            <div className="rounded-md border border-zinc-200 bg-white p-3">
              <p className="mb-1 text-xs font-semibold text-zinc-700">Sua numeração disponível</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(saldo).map(([k, v]) => (
                  <span key={k} className={"rounded-full px-2 py-0.5 " + (v > 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700")}>
                    {(NOMES_SALDO[k] || k) + ": " + v}
                  </span>
                ))}
              </div>
              {sncrUrl && (
                <a href={sncrUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-brand-teal-dark underline">
                  Pedir mais numeração no Gov.br (o link vale 5 minutos)
                </a>
              )}
            </div>
          )}

          {conta.vinculado && !conta.conectado && (
            <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-3">
              <p className="text-xs text-zinc-600">Conecte seu certificado digital. A aprovação vale por 8 horas.</p>
              <button type="button" disabled={busy || esperandoApp} onClick={conectarVidaas} className={btn + " bg-brand-navy text-white"}>
                {esperandoApp ? "Aguardando aprovação no app VIDaaS..." : "Conectar com VIDaaS"}
              </button>
              <div className="flex gap-2">
                <input className={input} value={otpBird} onChange={(e) => setOtpBird(e.target.value)} placeholder="Código do app BirdID" inputMode="numeric" />
                <button type="button" disabled={busy || !otpBird} onClick={conectarBird} className={btn + " bg-brand-teal text-white"}>BirdID</button>
              </div>
            </div>
          )}

          {pronto && !modoSncr && (
            <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-3">
              <select className={input} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <input className={input} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Medicamento (ex.: Clonazepam 2mg)" />
              <div className="grid grid-cols-3 gap-2">
                <input className={input} value={conc} onChange={(e) => setConc(e.target.value)} placeholder="Concentração" />
                <input className={input} value={forma} onChange={(e) => setForma(e.target.value)} placeholder="Forma (comprimido)" />
                <input className={input} value={qtd} onChange={(e) => setQtd(e.target.value)} placeholder="Quantidade" inputMode="numeric" />
              </div>
              <textarea className={input} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Posologia / orientações" />
              <p className="text-[11px] text-zinc-500">Notificação A, B e retinoides: 1 medicamento por receita. Cada receita consome 1 número da sua numeração.</p>
              <div className="flex gap-2">
                <button type="button" disabled={busy || !nome} onClick={() => emitir(true)} className={btn + " border border-zinc-300 bg-white text-zinc-700"}>Validar sem emitir</button>
                <button type="button" disabled={busy || !nome || !qtd} onClick={() => emitir(false)} className={btn + " bg-brand-teal text-white"}>
                  {busy ? "Emitindo..." : "Emitir e assinar"}
                </button>
              </div>
            </div>
          )}

          {modoSncr && conta.vinculado && (
            <button type="button" onClick={() => { setModoSncr(false); setCodigoEnviado(false); }} className="text-xs text-zinc-500 underline">Voltar</button>
          )}

          {emitido && <p className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-800">Receita controlada emitida e assinada. Nº SNCR: {emitido}</p>}
          {info && <p className="text-xs text-zinc-600">{info}</p>}
          {erro && <p className="rounded-md bg-red-50 p-2 text-xs text-red-700">{erro}</p>}
        </div>
      )}
    </div>
  );
}
