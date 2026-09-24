import { redirect } from "next/navigation";
import { getDoctorSession } from "@/lib/auth";
import DoctorShell from "@/components/DoctorShell";
import DoctorAppointmentsClient from "@/components/DoctorAppointmentsClient";

/**
 * Lista de atendimentos do médico (todas as datas), com filtro por
 * data, nome e CPF do paciente — pra achar uma consulta antiga e
 * ver/anexar exames do paciente sem depender da fila do dia.
 */
export default async function DoctorAppointmentsPage() {
  const session = await getDoctorSession();
  if (!session) redirect("/medico/login");

  return (
    <DoctorShell doctorName={session.name}>
      <DoctorAppointmentsClient />
    </DoctorShell>
  );
}
