import { redirect } from "next/navigation";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import DoctorShell from "@/components/DoctorShell";

export const dynamic = "force-dynamic";

function fmtSize(n: number | null) {
  if (!n) return "";
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

export default async function DoctorManualsPage() {
  const session = await getDoctorSession();
  if (!session) redirect("/medico/login");

  const supabase = getSupabaseAdmin();
  const { data: manuals } = await supabase
    .from("manuals")
    .select("id, title, description, sort_order, manual_categories!inner(name)")
    .eq("manual_categories.name", "Médicos")
    .order("sort_order");
  const ids = (manuals ?? []).map((m) => m.id);
  const { data: versions } = ids.length
    ? await supabase
        .from("manual_versions")
        .select("manual_id, version_label, file_name, size_bytes, uploaded_at")
        .in("manual_id", ids)
        .order("uploaded_at", { ascending: false })
    : { data: [] };
  const current = new Map<string, NonNullable<typeof versions>[number]>();
  for (const v of versions ?? []) if (!current.has(v.manual_id)) current.set(v.manual_id, v);

  return (
    <DoctorShell doctorName={session.name}>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-lg font-semibold text-zinc-900">Manuais</h1>
        <p className="mb-4 text-sm text-zinc-500">Guias para usar a plataforma. Baixe quando precisar.</p>
        {(manuals ?? []).length === 0 ? (
          <p className="rounded-xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-400">Nenhum manual disponível ainda.</p>
        ) : (
          <ul className="space-y-2">
            {(manuals ?? []).map((m) => {
              const v = current.get(m.id);
              if (!v) return null;
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4">
                  <div>
                    <p className="font-medium text-zinc-900">{m.title}</p>
                    {m.description && <p className="text-xs text-zinc-500">{m.description}</p>}
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {v.version_label} · atualizado em {new Date(v.uploaded_at).toLocaleDateString("pt-BR")}
                      {fmtSize(v.size_bytes) ? ` · ${fmtSize(v.size_bytes)}` : ""}
                    </p>
                  </div>
                  <a href={`/api/doctor/manuals/${m.id}/download`} className="shrink-0 rounded-md bg-brand-navy px-3 py-1.5 text-sm font-medium text-white">
                    Baixar
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DoctorShell>
  );
}
