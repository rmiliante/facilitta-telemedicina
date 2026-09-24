import { redirect } from "next/navigation";
import { getDoctorSession } from "@/lib/auth";
import DoctorShell from "@/components/DoctorShell";
import DoctorQueueClient from "@/components/DoctorQueueClient";

/**
 * Tela inicial do médico: fila de atendimento por ordem de chegada
 * (não mais uma agenda por horário). A atendente define quem é o
 * próximo; essa tela atualiza sozinha em segundo plano.
 */
export default async function DoctorAgendaPage() {
  const session = await getDoctorSession();
  if (!session) redirect("/medico/login");

  return (
    <DoctorShell doctorName={session.name}>
      <DoctorQueueClient />
    </DoctorShell>
  );
}
