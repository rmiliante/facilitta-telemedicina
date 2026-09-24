"use client";

import { useCallback, useEffect, useState } from "react";

export interface DocFile {
  path: string;
  name: string;
  uploaded_at: string;
}

export interface DocFileWithUrl extends DocFile {
  url: string | null;
}

/** Botão "📎" com contador — abre/fecha o painel de anexos do paciente sem navegar pra consulta. */
export function AttachmentsButton({
  patientId,
  count,
  isOpen,
  onToggle,
}: {
  patientId: string;
  count: number;
  isOpen: boolean;
  onToggle: (patientId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(patientId);
      }}
      className={`shrink-0 rounded-md border px-2 py-1 text-[10px] font-medium hover:bg-zinc-50 ${
        isOpen
          ? "border-brand-teal-dark bg-brand-teal/10 text-brand-teal-dark"
          : count > 0
            ? "border-brand-teal-dark text-brand-teal-dark"
            : "border-zinc-300 text-zinc-600"
      }`}
    >
      📎{count > 0 ? ` ${count}` : ""}
    </button>
  );
}

/** Painel de exames/documentos do paciente — anexar, ver e remover, ligado ao paciente (não à consulta). */
export function DocumentsPanel({
  patientId,
  onChange,
}: {
  patientId: string;
  onChange: (files: DocFile[]) => void;
}) {
  const [files, setFiles] = useState<DocFileWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}/documents`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files);
        onChange(data.files);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      selected.forEach((f) => formData.append("files", f));
      const res = await fetch(`/api/doctor/patients/${patientId}/documents`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files);
        onChange(data.files);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? "Falha ao anexar pedido de exame");
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleRemove(path: string) {
    if (!confirm("Remover esse documento anexado?")) return;
    const res = await fetch(`/api/doctor/patients/${patientId}/documents`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (res.ok) {
      const data = await res.json();
      setFiles(data.files);
      onChange(data.files);
    }
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs"
    >
      {loading ? (
        <p className="text-[11px] text-zinc-400">Carregando...</p>
      ) : (
        <>
          {files.length === 0 ? (
            <p className="mb-2 text-[11px] text-zinc-400">Nenhum exame/documento anexado ainda.</p>
          ) : (
            <ul className="mb-2 space-y-1">
              {files.map((f) => (
                <li key={f.path} className="flex items-center justify-between gap-2">
                  {f.url ? (
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-brand-teal-dark underline"
                    >
                      📎 {f.name}
                    </a>
                  ) : (
                    <span className="truncate text-zinc-400">📎 {f.name} (link indisponível)</span>
                  )}
                  <button
                    onClick={() => handleRemove(f.path)}
                    className="shrink-0 text-[10px] font-medium text-red-600 hover:underline"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="inline-block cursor-pointer">
            <span className="rounded-md bg-brand-teal/15 px-2.5 py-1 text-[11px] font-medium text-brand-teal-dark hover:bg-brand-teal/25">
              {uploading ? "Enviando..." : "+ Anexar pedido de exame"}
            </span>
            <input type="file" multiple onChange={handleUpload} disabled={uploading} className="hidden" />
          </label>
        </>
      )}
    </div>
  );
}
