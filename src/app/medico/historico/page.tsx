import { redirect } from "next/navigation";
import { getDoctorSession } from "@/lib/auth";
import DoctorShell from "@/components/DoctorShell";
import DoctorHistoryClient from "@/components/DoctorHistoryClient";

/**
 * Histórico de atendimentos do médico: o mesmo relatório do admin, só com
 * as consultas do médico logado (o servidor trava pelo login).
 */
export default async function DoctorHistoryPage() {
  const session = await getDoctorSession();
  if (!session) redirect("/medico/login");

  return (
    <DoctorShell doctorName={session.name}>
      <DoctorHistoryClient doctorName={session.name} />
    </DoctorShell>
  );
}
