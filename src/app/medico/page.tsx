import Link from "next/link";
import { redirect } from "next/navigation";
import { getDoctorSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import DoctorShell from "@/components/DoctorShell";

const STATUS_LABELS: Record<string, string> = {
  agendado: "Agendado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
  faltou: "Faltou",
};

const STATUS_STYLES: Record<string, string> = {
  agendado: "bg-brand-teal/15 text-brand-teal-dark",
  em_andamento: "bg-amber-100 text-amber-700",
  concluido: "bg-zinc-100 text-zinc-500",
  cancelado: "bg-red-100 text-red-600",
  faltou: "bg-red-100 text-red-600",
};

interface AppointmentRow {
  id: string;
  scheduled_at: string;
  status: string;
  patients: { id: string; full_name: string } | null;
  specialties: { name: string } | null;
}

export default async function DoctorAgendaPage() {
  const session = await getDoctorSession();
  if (!session) redirect("/medico/login");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, scheduled_at, status, patients(id, full_name), specialties(name)")
    .eq("doctor_id", session.doctorId)
    .neq("status", "cancelado")
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("Erro ao buscar agenda:", error);
  }

  const appointments = (data ?? []) as unknown as AppointmentRow[];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const today = appointments.filter((a) => {
    const d = new Date(a.scheduled_at);
    return d >= startOfToday && d < startOfTomorrow;
  });
  const upcoming = appointments.filter((a) => new Date(a.scheduled_at) >= startOfTomorrow);
  const past = appointments.filter((a) => new Date(a.scheduled_at) < startOfToday);

  return (
    <DoctorShell doctorName={session.name}>
      <AgendaSection title="Hoje" appointments={today} emptyText="Nenhuma consulta hoje." />
      <AgendaSection
        title="Próximas"
        appointments={upcoming}
        emptyText="Nenhuma consulta futura agendada."
      />
      {past.length > 0 && (
        <AgendaSection title="Anteriores" appointments={past} emptyText="" collapsedByDefault />
      )}
    </DoctorShell>
  );
}

function AgendaSection({
  title,
  appointments,
  emptyText,
  collapsedByDefault,
}: {
  title: string;
  appointments: AppointmentRow[];
  emptyText: string;
  collapsedByDefault?: boolean;
}) {
  return (
    <details className="mb-6" open={!collapsedByDefault}>
      <summary className="mb-2 cursor-pointer text-sm font-semibold text-zinc-700">
        {title} {appointments.length > 0 && `(${appointments.length})`}
      </summary>
      {appointments.length === 0 ? (
        <p className="text-xs text-zinc-400">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {appointments.map((a) => (
            <li key={a.id}>
              <Link
                href={`/medico/consulta/${a.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm hover:border-brand-teal-dark"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-800">
                    {a.patients?.full_name ?? "Paciente"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {new Date(a.scheduled_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {a.specialties?.name ? ` · ${a.specialties.name}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    STATUS_STYLES[a.status] ?? STATUS_STYLES.agendado
                  }`}
                >
                  {STATUS_LABELS[a.status] ?? a.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
