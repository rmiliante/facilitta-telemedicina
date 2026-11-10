"use client";

import { useEffect, useRef, useState } from "react";
import type { IssuedDocument } from "@/components/PrescriptionPanel";

/**
 * Cadastro guiado + emissão de receita controlada (azul, amarela, controle especial)
 * pela API de Prescrições da Prescreve. Só aparece com a flag PRESCREVE_PRESCRICOES_ATIVO.
 * Passos: 1 dados, 2 conta Prescreve, 3 CRM validado, 4 certificado, 5 numeração SNCR.
 */

interface Conta {
  ativo: boolean;
  cpfOk?: boolean;
  dadosOk?: boolean;
  faltando?: string[];
  vinculado?: boolean;
  crmValidado?: boolean;
  conectado?: boolean;
  emailPadrao?: string | null;
}

const TIPOS: { id: string; label: string }[] = [
  { id: "B1", label: "Notificação AZUL (B1)" },
  { id: "B2", label: "Notificação AZUL (B2)" },
  { id: "A1", label: "Notificação AMARELA (A1)" },
  { id: "A2", label: "Notificação AMARELA (A2)" },
  { id: "A3", label: "Notificação AMARELA (A3)" },
  { id: "C1", label: "Controle especial (C1)" },
  { id: "C5", label: "Controle especial (C5)" },
  { id: "C2", label: "Retinoides (C2)" },
  { id: "antimicrobiana", label: "Antimicrobiano" },
  { id: "GLP1", label: "GLP-1" },
];

const NOMES_SALDO: Record<string, string> = {
  NRA: "Amarela", NRB: "Azul B1", NRB2: "Azul B2", NRR: "Retinoides", NRT: "Talidomida", RCE: "Especial", RET: "Retenção",
};

/** Reduz a foto da carteira (celular costuma passar de 4 MB, limite do servidor) e converte para JPEG. */
async function prepararImagem(f: File): Promise<File> {
  if (!f.type.startsWith("image/")) return f;
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width * k);
    cv.height = Math.round(bmp.height * k);
    cv.getContext("2d")!.drawImage(bmp, 0, 0, cv.width, cv.height);
    const blob: Blob | null = await new Promise((r) => cv.toBlob(r, "image/jpeg", 0.85));
    if (!blob) return f;
    return new File([blob], (f.name.replace(/\.[^.]+$/, "") || "carteira") + ".jpg", { type: "image/jpeg" });
  } catch {
    return f;
  }
}

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

function Passo({ n, titulo, feito, atual, children }: { n: number; titulo: string; feito: boolean; atual: boolean; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-zinc-100 py-3 last:border-0">
      <div
        className={
          "flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold " +
          (feito ? "bg-emerald-100 text-emerald-800" : atual ? "bg-brand-navy text-white" : "bg-zinc-100 text-zinc-400")
        }
      >
        {feito ? "✓" : n}
      </div>
      <div className="min-w-0 flex-1">
        <p className={"text-sm font-semibold " + (feito || atual ? "text-brand-navy" : "text-zinc-400")}>{n + ". " + titulo}</p>
        {children}
      </div>
    </div>
  );
}

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
  const [modoConta, setModoConta] = useState<"criar" | "vincular">("criar");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [modoSncr, setModoSncr] = useState(false);
  const [pedirToken, setPedirToken] = useState(false);
  const token = useRef<string | null>(null);
  const [saldo, setSaldo] = useState<Record<string, number> | null>(null);
  const [sncrUrl, setSncrUrl] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [crmMsg, setCrmMsg] = useState<string | null>(null);
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

  const passo1 = !!conta.dadosOk;
  const passo2 = !!conta.vinculado;
  const passo3 = passo2 && !!conta.crmValidado;
  const passo4 = passo3 && !!conta.conectado;
  const pronto = passo4;
  const atual = !passo1 ? 1 : !passo2 ? 2 : !passo3 ? 3 : !passo4 ? 4 : 5;
  const status = pronto ? "Pronto para assinar" : "Cadastro: passo " + atual + " de 5";
  const corStatus = pronto ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800";

  async function criarConta() {
    setBusy(true); setErro(null); setInfo(null);
    const r = await api({ action: "criar_conta", email, senha, confirmacao });
    setBusy(false);
    setSenha(""); setConfirmacao("");
    if (!r.ok) return setErro(String(r.error || "Não foi possível criar a conta"));
    setCodigoEnviado(!!r.codigoEnviado);
    setInfo(r.codigoEnviado ? "Conta criada. Enviamos um código para " + String(r.email) + "." : "Conta criada. Clique em Enviar código para confirmar.");
    setModoConta("vincular");
  }
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
    token.current = (r.token as string) || null;
    setSaldo((r.saldo as Record<string, number>) || null);
    setSncrUrl((r.sncrUrl as string) || null);
    setCodigo(""); setCodigoEnviado(false); setPedirToken(false);
    setInfo("Conta confirmada.");
    carregar();
  }
  async function enviarCrm() {
    if (!arquivo || !token.current) return;
    setBusy(true); setErro(null); setInfo(null); setCrmMsg(null);
    const anexo = await prepararImagem(arquivo);
    if (anexo.size > 4 * 1024 * 1024) { setBusy(false); return setErro("O arquivo passa de 4 MB. Envie uma foto menor ou um PDF mais leve."); }
    const fd = new FormData();
    fd.append("token", token.current);
    fd.append("file", anexo);
    const res = await fetch("/api/doctor/prescreve/validacao", { method: "POST", body: fd }).catch(() => null);
    const r = res ? await res.json().catch(() => ({})) : { error: "Sem conexão. Tente de novo." };
    setBusy(false);
    if (res && res.status === 413) return setErro("O arquivo é grande demais. Envie uma foto menor ou um PDF mais leve (até 4 MB).");
    if (!res || !res.ok) return setErro(String(r.error || "Falha ao enviar"));
    if (r.validado) { setInfo("CRM validado."); setArquivo(null); carregar(); }
    else setCrmMsg(String(r.motivo || "O documento foi enviado e está em análise. Volte mais tarde."));
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

  function blocoCodigo(texto: string) {
    return (
      <div className="mt-2 space-y-2 rounded-md border border-zinc-200 bg-white p-3">
        <p className="text-xs text-zinc-600">{texto}</p>
        <input className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail da sua conta na Prescreve" disabled={codigoEnviado} />
        {!codigoEnviado ? (
          <button type="button" disabled={busy || !email} onClick={pedirCodigo} className={btn + " bg-brand-navy text-white"}>Enviar código</button>
        ) : (
          <div className="flex gap-2">
            <input className={input} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Código recebido" inputMode="numeric" />
            <button type="button" disabled={busy || !codigo} onClick={validarCodigo} className={btn + " bg-brand-teal text-white"}>Confirmar</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-b border-zinc-100 bg-zinc-50 px-5 py-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setOpen(!open)} className="text-left text-sm font-semibold text-brand-navy">
          Receita controlada (azul / amarela / especial)
        </button>
        <span className={"rounded-full px-2 py-0.5 text-[11px] font-medium " + corStatus}>{status}</span>
      </div>

      {open && (
        <div className="mt-3 text-sm">
          <a href="/manuais/guia-receita-controlada.pdf" target="_blank" rel="noreferrer" className="mb-2 inline-block text-xs font-semibold text-brand-teal-dark underline">
            Baixar o manual em PDF (passo a passo)
          </a>
          <div className="rounded-md border border-zinc-200 bg-white px-3">
            <Passo n={1} titulo="Seus dados" feito={passo1} atual={atual === 1}>
              {!passo1 && (
                <p className="mt-1 rounded-md bg-red-50 p-2 text-xs text-red-700">
                  Falta no seu cadastro da Facilitta: {(conta.faltando || []).join(", ")}. Peça à administração para completar.
                </p>
              )}
            </Passo>

            <Passo n={2} titulo="Conta da Prescreve" feito={passo2} atual={atual === 2}>
              {passo1 && !passo2 && (
                <div className="mt-1">
                  <div className="mb-2 flex gap-2 text-xs">
                    <button type="button" onClick={() => setModoConta("criar")} className={btn + (modoConta === "criar" ? " bg-brand-navy text-white" : " border border-zinc-300 bg-white text-zinc-700")}>Criar minha conta</button>
                    <button type="button" onClick={() => setModoConta("vincular")} className={btn + (modoConta === "vincular" ? " bg-brand-navy text-white" : " border border-zinc-300 bg-white text-zinc-700")}>Já tenho conta</button>
                  </div>
                  {modoConta === "criar" && !codigoEnviado ? (
                    <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-3">
                      <p className="text-xs text-zinc-600">A Facilitta cria a sua conta na Prescreve com os dados do seu cadastro. Escolha o e-mail e uma senha (mínimo 6 caracteres). A senha não fica guardada na Facilitta.</p>
                      <input className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Seu e-mail" autoComplete="email" />
                      <input className={input} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Escolha uma senha" autoComplete="new-password" />
                      <input className={input} type="password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} placeholder="Repita a senha" autoComplete="new-password" />
                      <button type="button" disabled={busy || !email || !senha || !confirmacao} onClick={criarConta} className={btn + " bg-brand-navy text-white"}>Criar conta</button>
                    </div>
                  ) : (
                    blocoCodigo("Enviamos um código para o e-mail da sua conta na Prescreve. Digite aqui para confirmar.")
                  )}
                </div>
              )}
              {passo2 && <p className="mt-1 text-xs text-zinc-500">Conta vinculada.</p>}
            </Passo>

            <Passo n={3} titulo="Validação do CRM" feito={passo3} atual={atual === 3}>
              {passo2 && !passo3 && (
                <div className="mt-1 space-y-2">
                  <p className="text-xs text-zinc-600">Envie uma foto ou PDF da carteira do conselho. A validação é automática e pode passar por revisão manual. Sem ela aprovada, não é possível emitir.</p>
                  {!token.current || pedirToken ? (
                    blocoCodigo("Para enviar o documento, confirme sua conta com o código do e-mail.")
                  ) : (
                    <div className="space-y-2 rounded-md border border-zinc-200 bg-white p-3">
                      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setArquivo(e.target.files?.[0] || null)} className="w-full text-xs" />
                      <button type="button" disabled={busy || !arquivo} onClick={enviarCrm} className={btn + " bg-brand-navy text-white"}>
                        {busy ? "Enviando..." : "Enviar para validação"}
                      </button>
                    </div>
                  )}
                  {crmMsg && <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-800">{crmMsg}</p>}
                  {token.current && (
                    <button type="button" onClick={carregar} className="text-xs text-zinc-500 underline">Atualizar situação</button>
                  )}
                </div>
              )}
            </Passo>

            <Passo n={4} titulo="Certificado digital" feito={passo4} atual={atual === 4}>
              {passo3 && !passo4 && (
                <div className="mt-1 space-y-2 rounded-md border border-zinc-200 bg-white p-3">
                  <p className="text-xs text-zinc-600">A aprovação vale por 8 horas.</p>
                  <button type="button" disabled={busy || esperandoApp} onClick={conectarVidaas} className={btn + " bg-brand-navy text-white"}>
                    {esperandoApp ? "Aguardando aprovação no app VIDaaS..." : "Conectar com VIDaaS"}
                  </button>
                  <div className="flex gap-2">
                    <input className={input} value={otpBird} onChange={(e) => setOtpBird(e.target.value)} placeholder="Código do app BirdID" inputMode="numeric" />
                    <button type="button" disabled={busy || !otpBird} onClick={conectarBird} className={btn + " bg-brand-teal text-white"}>BirdID</button>
                  </div>
                </div>
              )}
              {passo4 && (
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-xs text-zinc-500">Conectado.</p>
                  <button type="button" disabled={busy} onClick={async () => { await api({ action: "encerrar" }); carregar(); }} className="text-xs text-zinc-500 underline">Encerrar sessão</button>
                </div>
              )}
            </Passo>

            <Passo n={5} titulo="Numeração SNCR" feito={false} atual={atual === 5}>
              {passo2 && (
                <div className="mt-1 space-y-2">
                  <p className="text-xs text-zinc-600">
                    Os números são seus e o pedido é sempre feito por você, com o seu Gov.br. Azul e amarela: você escolhe de 10 a 50 números por tipo, por pedido (depende do que a Vigilância Sanitária já liberou). Controle especial e retenção: 1.000 números por pedido, no máximo 3 pedidos por mês. O saldo atualiza na hora.
                  </p>
                  {!modoSncr ? (
                    <button type="button" onClick={() => { setModoSncr(true); setCodigoEnviado(false); setSaldo(null); setSncrUrl(null); }} className={btn + " border border-zinc-300 bg-white text-zinc-700"}>Ver saldo / pedir numeração</button>
                  ) : (
                    <>
                      {!saldo && blocoCodigo("Confirme sua conta com o código do e-mail para ver o saldo e abrir o pedido.")}
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
                          <p className="mt-1 text-[11px] text-zinc-500">Depois do pedido, abra de novo "Ver saldo" para atualizar.</p>
                        </div>
                      )}
                      <button type="button" onClick={() => { setModoSncr(false); setCodigoEnviado(false); }} className="text-xs text-zinc-500 underline">Fechar</button>
                    </>
                  )}
                </div>
              )}
            </Passo>
          </div>

          {pronto && (
            <div className="mt-3 space-y-2 rounded-md border border-zinc-200 bg-white p-3">
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

          {emitido && <p className="mt-2 rounded-md bg-emerald-50 p-2 text-xs text-emerald-800">Receita controlada emitida e assinada. Nº SNCR: {emitido}</p>}
          {info && <p className="mt-2 text-xs text-zinc-600">{info}</p>}
          {erro && <p className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700">{erro}</p>}
        </div>
      )}
    </div>
  );
}
