"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

const BUCKET = "manuais";
const MAX_BYTES = 25 * 1024 * 1024;
export const MANUAIS_CATEGORY_EVENT = "manuais:category";
const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg,.webp";

interface Category { id: string; name: string; sort_order: number }
interface Version {
  id: string; version_label: string; notes: string | null; file_name: string;
  mime_type: string | null; size_bytes: number | null; uploaded_by: string | null; uploaded_at: string;
}
interface Manual {
  id: string; title: string; description: string | null; category_id: string | null;
  sort_order: number; updated_at: string; current: Version | null; versionsCount: number;
}
interface Pending { title: string; body: string; label: string; danger?: boolean; onCancel?: () => void; run: () => Promise<void> }

function fmtSize(n: number | null) {
  if (!n) return "—";
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fileIcon(name?: string | null) {
  const ext = (name ?? "").split(".").pop()?.toLowerCase();
  if (ext === "pdf") return { t: "PDF", c: "bg-red-50 text-red-600" };
  if (ext === "doc" || ext === "docx") return { t: "DOC", c: "bg-blue-50 text-blue-600" };
  if (ext === "ppt" || ext === "pptx") return { t: "PPT", c: "bg-orange-50 text-orange-600" };
  return { t: "IMG", c: "bg-emerald-50 text-emerald-600" };
}
async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Erro inesperado");
  return j;
}
async function uploadFile(file: File): Promise<{ path: string }> {
  if (file.size > MAX_BYTES) throw new Error("Arquivo acima de 25 MB");
  const { path, token } = await api("/api/admin/manuals/upload-url", { method: "POST", body: JSON.stringify({ fileName: file.name }) });
  const { error } = await getSupabaseBrowser().storage.from(BUCKET).uploadToSignedUrl(path, token, file);
  if (error) throw new Error("Falha ao enviar o arquivo");
  return { path };
}

/** Sub-itens do menu lateral: categorias de manuais. */
export function ManuaisSubmenu({ active, onSelect }: { active: boolean; onSelect: (categoryId: string | null) => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    api("/api/admin/manuals").then((j) => setCats(j.categories)).catch(() => {});
    const h = (e: Event) => setSel((e as CustomEvent<string | null>).detail ?? null);
    window.addEventListener(MANUAIS_CATEGORY_EVENT, h);
    return () => window.removeEventListener(MANUAIS_CATEGORY_EVENT, h);
  }, []);
  if (!active) return null;
  const item = (id: string | null, label: string) => (
    <button
      key={id ?? "all"}
      onClick={() => { setSel(id); onSelect(id); }}
      className={`block w-full rounded-md px-3 py-1.5 text-left text-xs ${sel === id ? "font-semibold text-brand-teal-dark" : "text-zinc-500 hover:text-zinc-800"}`}
    >
      {label}
    </button>
  );
  return (
    <div className="ml-4 mt-1 space-y-0.5 border-l border-zinc-200 pl-2">
      {item(null, "Todos os manuais")}
      {cats.map((c) => item(c.id, c.name))}
    </div>
  );
}

export default function ManuaisTab() {
  const [cats, setCats] = useState<Category[]>([]);
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [upload, setUpload] = useState<{ file: File | null } | null>(null);
  const [newVersion, setNewVersion] = useState<Manual | null>(null);
  const [editing, setEditing] = useState<Manual | null>(null);
  const [history, setHistory] = useState<Manual | null>(null);
  const [catDialog, setCatDialog] = useState<{ cat: Category | null } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try {
      const j = await api("/api/admin/manuals");
      setCats(j.categories);
      setManuals(j.manuals);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = (e: Event) => setFilter((e as CustomEvent<string | null>).detail ?? null);
    window.addEventListener(MANUAIS_CATEGORY_EVENT, h);
    return () => window.removeEventListener(MANUAIS_CATEGORY_EVENT, h);
  }, []);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3500); };

  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? "Sem categoria";
  const visible = manuals.filter((m) => !filter || m.category_id === filter);

  function setFilterAndNotify(id: string | null) {
    setFilter(id);
    window.dispatchEvent(new CustomEvent(MANUAIS_CATEGORY_EVENT, { detail: id }));
  }

  function askDelete(m: Manual) {
    setPending({
      title: "Excluir manual?",
      body: `“${m.title}” e todas as ${m.versionsCount} versão(ões) serão removidos. Essa ação não pode ser desfeita.`,
      label: "Excluir",
      danger: true,
      run: async () => {
        try { await api(`/api/admin/manuals/${m.id}`, { method: "DELETE" }); flash("Manual excluído"); } catch (e) { setError(e instanceof Error ? e.message : "Erro"); }
        await load();
      },
    });
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const prev = manuals;
    const ids = manuals.map((m) => m.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    const next = ids.map((id) => manuals.find((m) => m.id === id)!);
    setManuals(next);
    setDragId(null);
    setPending({
      title: "Salvar nova ordem?",
      body: "A ordem dos manuais será alterada para todos os administradores.",
      label: "Salvar ordem",
      onCancel: () => setManuals(prev),
      run: async () => {
        try { await api("/api/admin/manuals/reorder", { method: "POST", body: JSON.stringify({ ids }) }); flash("Ordem salva"); } catch (e) { setError(e instanceof Error ? e.message : "Erro"); setManuals(prev); }
      },
    });
  }

  function askDeleteCategory(c: Category) {
    setPending({
      title: "Excluir categoria?",
      body: `A categoria “${c.name}” será removida (só é possível se estiver vazia).`,
      label: "Excluir",
      danger: true,
      run: async () => {
        try { await api(`/api/admin/manuals/categories/${c.id}`, { method: "DELETE" }); if (filter === c.id) setFilterAndNotify(null); } catch (e) { setError(e instanceof Error ? e.message : "Erro"); }
        await load();
      },
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Manuais</h2>
          <p className="text-sm text-zinc-500">Guias e materiais da plataforma, organizados por categoria.</p>
        </div>
        <button onClick={() => setUpload({ file: null })} className="rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white">
          + Enviar manual
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {[{ id: null as string | null, name: "Todos" }, ...cats].map((c) => (
          <button
            key={c.id ?? "all"}
            onClick={() => setFilterAndNotify(c.id)}
            className={`rounded-full border px-3 py-1 text-xs ${filter === c.id ? "border-brand-navy bg-brand-navy text-white" : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"}`}
          >
            {c.name}
          </button>
        ))}
        <button onClick={() => setCatDialog({ cat: null })} className="rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs text-zinc-500 hover:bg-zinc-50">
          + Nova categoria
        </button>
        {filter && (() => {
          const c = cats.find((x) => x.id === filter);
          return c ? (
            <span className="ml-2 flex gap-2 text-xs">
              <button onClick={() => setCatDialog({ cat: c })} className="text-zinc-500 underline">Renomear</button>
              <button onClick={() => askDeleteCategory(c)} className="text-red-600 underline">Excluir categoria</button>
            </span>
          ) : null;
        })()}
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setUpload({ file: f }); }}
        className="mb-4 cursor-pointer rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-5 text-center text-sm text-zinc-500 hover:bg-zinc-100"
        onClick={() => setUpload({ file: null })}
      >
        Arraste um arquivo aqui ou clique para enviar <span className="text-zinc-400">(PDF, Word, PowerPoint ou imagem · até 25 MB)</span>
      </div>

      {error && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {toast && <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{toast}</p>}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="w-8 px-2 py-2" />
              <th className="px-3 py-2">Manual</th>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Versão</th>
              <th className="px-3 py-2">Atualizado</th>
              <th className="px-3 py-2">Tamanho</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-3 py-6 text-center text-zinc-400">Carregando…</td></tr>}
            {!loading && visible.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-zinc-400">Nenhum manual por aqui ainda.</td></tr>}
            {visible.map((m) => {
              const ic = fileIcon(m.current?.file_name);
              return (
                <tr
                  key={m.id}
                  draggable={!filter}
                  onDragStart={() => setDragId(m.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.stopPropagation(); onDrop(m.id); }}
                  className={`border-t border-zinc-100 ${dragId === m.id ? "opacity-50" : ""}`}
                >
                  <td className={`px-2 py-2 text-center text-zinc-400 ${filter ? "" : "cursor-grab"}`} title={filter ? "Mostre “Todos” para reordenar" : "Arraste para reordenar"}>⋮⋮</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${ic.c}`}>{ic.t}</span>
                      <div>
                        <p className="font-medium text-zinc-900">{m.title}</p>
                        {m.description && <p className="text-xs text-zinc-500">{m.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2"><span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">{catName(m.category_id)}</span></td>
                  <td className="px-3 py-2">
                    <button onClick={() => setHistory(m)} className="text-xs font-medium text-brand-navy underline" title="Ver histórico de versões">
                      {m.current?.version_label ?? "—"}{m.versionsCount > 1 ? ` (${m.versionsCount})` : ""}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{fmtDate(m.current?.uploaded_at ?? m.updated_at)}</td>
                  <td className="px-3 py-2 text-zinc-600">{fmtSize(m.current?.size_bytes ?? null)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5 whitespace-nowrap">
                      <a href={`/api/admin/manuals/${m.id}/download`} className="rounded-md bg-brand-navy px-2.5 py-1 text-xs font-medium text-white">Baixar</a>
                      <button onClick={() => setNewVersion(m)} className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50">Nova versão</button>
                      <button onClick={() => setEditing(m)} className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50">Editar</button>
                      <button onClick={() => askDelete(m)} className="rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50">Excluir</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {upload && (
        <UploadDialog
          cats={cats}
          initialFile={upload.file}
          defaultCategory={filter}
          onClose={() => setUpload(null)}
          onAsk={setPending}
          onDone={async () => { setUpload(null); flash("Manual enviado"); await load(); }}
        />
      )}
      {newVersion && (
        <NewVersionDialog
          manual={newVersion}
          onClose={() => setNewVersion(null)}
          onAsk={setPending}
          onDone={async () => { setNewVersion(null); flash("Nova versão publicada"); await load(); }}
        />
      )}
      {editing && (
        <EditDialog
          manual={editing}
          cats={cats}
          onClose={() => setEditing(null)}
          onAsk={setPending}
          onDone={async () => { setEditing(null); flash("Alterações salvas"); await load(); }}
        />
      )}
      {history && <HistoryDialog manual={history} onClose={() => setHistory(null)} />}
      {catDialog && (
        <CategoryDialog
          cat={catDialog.cat}
          onClose={() => setCatDialog(null)}
          onAsk={setPending}
          onDone={async () => { setCatDialog(null); await load(); }}
        />
      )}
      {pending && (
        <Confirm
          action={pending}
          onCancel={() => {
            pending.onCancel?.();
            setPending(null);
          }}
          onConfirm={async () => { const run = pending.run; setPending(null); await run(); }}
        />
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-semibold text-zinc-900">{title}</h3>
        {children}
      </div>
    </div>
  );
}
function Confirm({ action, onCancel, onConfirm }: { action: Pending; onCancel: () => void; onConfirm: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => { if (!busy) onCancel(); }}>
      <div role="alertdialog" aria-modal="true" className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-zinc-900">{action.title}</h3>
        <p className="mt-2 whitespace-pre-line text-sm text-zinc-600">{action.body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button disabled={busy} onClick={onCancel} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600">Cancelar</button>
          <button
            disabled={busy}
            onClick={async () => { setBusy(true); await onConfirm(); }}
            className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60 ${action.danger ? "bg-red-600" : "bg-brand-navy"}`}
          >
            {busy ? "Aguarde…" : action.label}
          </button>
        </div>
      </div>
    </div>
  );
}
const inputCls = "w-full rounded-md border border-zinc-300 px-3 py-2 text-sm";
const labelCls = "mb-1 block text-xs font-medium text-zinc-600";

function FilePicker({ file, onPick }: { file: File | null; onPick: (f: File | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className={labelCls}>Arquivo</label>
      <input ref={ref} type="file" accept={ACCEPT} className="hidden" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
      <button type="button" onClick={() => ref.current?.click()} className="w-full rounded-md border border-dashed border-zinc-300 px-3 py-3 text-sm text-zinc-600 hover:bg-zinc-50">
        {file ? `${file.name} · ${fmtSize(file.size)}` : "Escolher arquivo…"}
      </button>
    </div>
  );
}

function UploadDialog({ cats, initialFile, defaultCategory, onClose, onAsk, onDone }: {
  cats: Category[]; initialFile: File | null; defaultCategory: string | null;
  onClose: () => void; onAsk: (p: Pending) => void; onDone: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(initialFile);
  const [title, setTitle] = useState(initialFile ? initialFile.name.replace(/\.[^.]+$/, "") : "");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState(defaultCategory ?? "");
  const [err, setErr] = useState("");
  const submit = () => {
    if (!file) return setErr("Escolha um arquivo");
    if (!title.trim()) return setErr("Informe o título");
    if (file.size > MAX_BYTES) return setErr("Arquivo acima de 25 MB");
    setErr("");
    onAsk({
      title: "Enviar manual?",
      body: `“${title.trim()}” (${file.name}, ${fmtSize(file.size)}) será publicado como v1.0.`,
      label: "Enviar",
      run: async () => {
        try {
          const { path } = await uploadFile(file);
          await api("/api/admin/manuals", {
            method: "POST",
            body: JSON.stringify({ title, description, categoryId, path, fileName: file.name, mime: file.type, size: file.size }),
          });
          await onDone();
        } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
      },
    });
  };
  return (
    <Modal title="Enviar manual" onClose={onClose}>
      <div className="space-y-3">
        <FilePicker file={file} onPick={(f) => { setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, "")); }} />
        <div><label className={labelCls}>Título</label><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label className={labelCls}>Descrição (opcional)</label><input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div>
          <label className={labelCls}>Categoria</label>
          <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600">Cancelar</button>
          <button onClick={submit} className="rounded-md bg-brand-navy px-3 py-1.5 text-sm font-medium text-white">Enviar</button>
        </div>
      </div>
    </Modal>
  );
}

function NewVersionDialog({ manual, onClose, onAsk, onDone }: { manual: Manual; onClose: () => void; onAsk: (p: Pending) => void; onDone: () => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => {
    api(`/api/admin/manuals/${manual.id}/versions`).then((j) => setLabel(j.suggested)).catch(() => {});
  }, [manual.id]);
  const submit = () => {
    if (!file) return setErr("Escolha o arquivo da nova versão");
    setErr("");
    onAsk({
      title: "Publicar nova versão?",
      body: `“${manual.title}” passa de ${manual.current?.version_label ?? "—"} para ${label || "nova versão"}. A versão anterior continua no histórico.`,
      label: "Publicar",
      run: async () => {
        try {
          const { path } = await uploadFile(file);
          await api(`/api/admin/manuals/${manual.id}/versions`, {
            method: "POST",
            body: JSON.stringify({ path, fileName: file.name, mime: file.type, size: file.size, versionLabel: label, notes }),
          });
          await onDone();
        } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
      },
    });
  };
  return (
    <Modal title={`Nova versão · ${manual.title}`} onClose={onClose}>
      <div className="space-y-3">
        <FilePicker file={file} onPick={setFile} />
        <div><label className={labelCls}>Versão</label><input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} /></div>
        <div><label className={labelCls}>O que mudou (opcional)</label><input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600">Cancelar</button>
          <button onClick={submit} className="rounded-md bg-brand-navy px-3 py-1.5 text-sm font-medium text-white">Publicar</button>
        </div>
      </div>
    </Modal>
  );
}

function EditDialog({ manual, cats, onClose, onAsk, onDone }: { manual: Manual; cats: Category[]; onClose: () => void; onAsk: (p: Pending) => void; onDone: () => Promise<void> }) {
  const [title, setTitle] = useState(manual.title);
  const [description, setDescription] = useState(manual.description ?? "");
  const [categoryId, setCategoryId] = useState(manual.category_id ?? "");
  const [err, setErr] = useState("");
  const submit = () => {
    if (!title.trim()) return setErr("Informe o título");
    const changes: string[] = [];
    if (title.trim() !== manual.title) changes.push(`• Título: ${manual.title} → ${title.trim()}`);
    if (description.trim() !== (manual.description ?? "")) changes.push("• Descrição alterada");
    if (categoryId !== (manual.category_id ?? "")) changes.push(`• Categoria: ${cats.find((c) => c.id === manual.category_id)?.name ?? "Sem categoria"} → ${cats.find((c) => c.id === categoryId)?.name ?? "Sem categoria"}`);
    if (!changes.length) return onClose();
    onAsk({
      title: "Salvar alterações?",
      body: changes.join("\n"),
      label: "Salvar",
      run: async () => {
        try {
          await api(`/api/admin/manuals/${manual.id}`, { method: "PATCH", body: JSON.stringify({ title, description, categoryId: categoryId || null }) });
          await onDone();
        } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
      },
    });
  };
  return (
    <Modal title="Editar manual" onClose={onClose}>
      <div className="space-y-3">
        <div><label className={labelCls}>Título</label><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label className={labelCls}>Descrição</label><input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div>
          <label className={labelCls}>Categoria</label>
          <select className={inputCls} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600">Cancelar</button>
          <button onClick={submit} className="rounded-md bg-brand-navy px-3 py-1.5 text-sm font-medium text-white">Salvar</button>
        </div>
      </div>
    </Modal>
  );
}

function HistoryDialog({ manual, onClose }: { manual: Manual; onClose: () => void }) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  useEffect(() => {
    api(`/api/admin/manuals/${manual.id}/versions`).then((j) => setVersions(j.versions)).catch(() => setVersions([]));
  }, [manual.id]);
  return (
    <Modal title={`Histórico · ${manual.title}`} onClose={onClose}>
      {!versions ? <p className="text-sm text-zinc-400">Carregando…</p> : (
        <ul className="divide-y divide-zinc-100">
          {versions.map((v, i) => (
            <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <p className="font-medium text-zinc-900">{v.version_label}{i === 0 && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">atual</span>}</p>
                <p className="text-xs text-zinc-500">{fmtDate(v.uploaded_at)} · {fmtSize(v.size_bytes)}{v.uploaded_by ? ` · ${v.uploaded_by}` : ""}</p>
                {v.notes && <p className="text-xs text-zinc-500">{v.notes}</p>}
              </div>
              <a href={`/api/admin/manuals/${manual.id}/download?version=${v.id}`} className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:bg-zinc-50">Baixar</a>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex justify-end">
        <button onClick={onClose} className="rounded-md bg-brand-navy px-3 py-1.5 text-sm font-medium text-white">Fechar</button>
      </div>
    </Modal>
  );
}

function CategoryDialog({ cat, onClose, onAsk, onDone }: { cat: Category | null; onClose: () => void; onAsk: (p: Pending) => void; onDone: () => Promise<void> }) {
  const [name, setName] = useState(cat?.name ?? "");
  const [err, setErr] = useState("");
  const submit = () => {
    if (!name.trim()) return setErr("Informe o nome");
    onAsk({
      title: cat ? "Renomear categoria?" : "Criar categoria?",
      body: cat ? `“${cat.name}” → “${name.trim()}”` : `Será criada a categoria “${name.trim()}”.`,
      label: cat ? "Renomear" : "Criar",
      run: async () => {
        try {
          await api(cat ? `/api/admin/manuals/categories/${cat.id}` : "/api/admin/manuals/categories", {
            method: cat ? "PATCH" : "POST",
            body: JSON.stringify({ name }),
          });
          await onDone();
        } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
      },
    });
  };
  return (
    <Modal title={cat ? "Renomear categoria" : "Nova categoria"} onClose={onClose}>
      <div className="space-y-3">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da categoria" autoFocus />
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600">Cancelar</button>
          <button onClick={submit} className="rounded-md bg-brand-navy px-3 py-1.5 text-sm font-medium text-white">Continuar</button>
        </div>
      </div>
    </Modal>
  );
}
