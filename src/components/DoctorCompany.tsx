"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

const BUCKET = "medicos-docs";

interface Anexo {
  path: string;
  name: string;
  uploaded_at: string;
  url: string | null;
}

const vazio = { razao: "", cnpj: "", cep: "", endereco: "", repNome: "", repCpf: "" };
const inputCls = "w-full rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-teal-dark";

/** Empresa (PJ) do médico — usada no contrato — e documentos anexados ao cadastro. */
export default function DoctorCompany({ doctorId }: { doctorId: string }) {
  const [f, setF] = useState(vazio);
  const [files, setFiles] = useState<Anexo[]>([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [eRes, dRes] = await Promise.all([
      fetch(`/api/admin/doctors/${doctorId}/empresa`),
      fetch(`/api/admin/doctors/${doctorId}/docs`),
    ]);
    if (eRes.ok) {
      const { empresa: e } = await eRes.json();
      setF({
        razao: e?.pj_razao ?? "",
        cnpj: e?.pj_cnpj ?? "",
        cep: e?.pj_cep ?? "",
        endereco: e?.pj_endereco ?? "",
        repNome: e?.pj_rep_nome ?? "",
        repCpf: e?.pj_rep_cpf ?? "",
      });
    }
    if (dRes.ok) setFiles((await dRes.json()).files ?? []);
  }, [doctorId]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  async function salvar() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/doctors/${doctorId}/empresa`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      setMsg(res.ok ? "Dados da empresa salvos." : (await res.json().catch(() => ({}))).error ?? "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function enviar(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploading(true);
    setMsg("");
    try {
      for (const file of Array.from(list)) {
        const t = await fetch(`/api/admin/doctors/${doctorId}/docs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "upload-url", fileName: file.name }),
        });
        if (!t.ok) throw new Error((await t.json().catch(() => ({}))).error ?? `Falha ao preparar "${file.name}"`);
        const { path, token } = (await t.json()) as { path: string; token: string };
        const { error } = await getSupabaseBrowser().storage.from(BUCKET).uploadToSignedUrl(path, token, file);
        if (error) throw new Error(`Falha ao enviar "${file.name}": ${error.message}`);
        const fin = await fetch(`/api/admin/doctors/${doctorId}/docs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "finalize", path, name: file.name }),
        });
        if (!fin.ok) throw new Error((await fin.json().catch(() => ({}))).error ?? "Falha ao registrar o arquivo");
        setFiles((await fin.json()).files ?? []);
      }
      setMsg("Arquivo anexado.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falha ao anexar.");
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remover(a: Anexo) {
    if (!confirm(`Tirar "${a.name}" da lista de anexos? O arquivo continua guardado.`)) return;
    const res = await fetch(`/api/admin/doctors/${doctorId}/docs`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: a.path }),
    });
    if (res.ok) setFiles((await res.json()).files ?? []);
  }

  const set = (k: keyof typeof vazio) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-3">
        <p className="mb-2 text-sm font-bold text-brand-navy">
          Empresa do médico (PJ) <span className="font-normal text-zinc-500">· usada no contrato</span>
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <input value={f.razao} onChange={set("razao")} placeholder="Razão social" className={inputCls + " sm:col-span-2"} />
          <input value={f.cnpj} onChange={set("cnpj")} placeholder="CNPJ" className={inputCls} />
          <input value={f.endereco} onChange={set("endereco")} placeholder="Endereço da sede (rua, nº, sala, bairro, cidade/UF)" className={inputCls + " sm:col-span-2"} />
          <input value={f.cep} onChange={set("cep")} placeholder="CEP" className={inputCls} />
          <input value={f.repNome} onChange={set("repNome")} placeholder="Representante" className={inputCls + " sm:col-span-2"} />
          <input value={f.repCpf} onChange={set("repCpf")} placeholder="CPF do representante" className={inputCls} />
        </div>
        <button type="button" onClick={salvar} disabled={saving} className="mt-2 rounded-md bg-brand-teal-dark px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
          {saving ? "Salvando…" : "Salvar dados da empresa"}
        </button>
      </div>

      <div className="rounded-lg border border-zinc-200 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-brand-navy">Documentos anexados</p>
          <button type="button" onClick={() => input.current?.click()} disabled={uploading} className="rounded-md border border-brand-teal-dark px-3 py-1.5 text-xs font-semibold text-brand-teal-dark disabled:opacity-50">
            {uploading ? "Enviando…" : "📎 Anexar arquivo (PDF/imagem)"}
          </button>
          <input ref={input} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => enviar(e.target.files)} />
        </div>
        {files.length === 0 ? (
          <p className="text-xs text-zinc-400">Nenhum documento anexado.</p>
        ) : (
          <ul className="space-y-1">
            {files.map((a) => (
              <li key={a.path} className="flex items-center justify-between gap-2 rounded-md bg-zinc-50 px-2 py-1.5 text-xs">
                <span className="truncate">
                  📄 {a.name} <span className="text-zinc-400">· {new Date(a.uploaded_at).toLocaleDateString("pt-BR")}</span>
                </span>
                <span className="shrink-0">
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noreferrer" className="text-brand-teal-dark hover:underline">
                      Abrir
                    </a>
                  )}{" "}
                  ·{" "}
                  <button type="button" onClick={() => remover(a)} className="text-red-600 hover:underline">
                    Remover
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {msg && <p className="text-xs text-zinc-600">{msg}</p>}
    </div>
  );
}
