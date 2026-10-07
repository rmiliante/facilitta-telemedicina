import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth";
import SchedulingPanel from "@/components/SchedulingPanel";

// Área da equipe de Agendamento (cadastro de pacientes e agenda).
export default async function AgendamentoPage() {
  const session = await getStaffSession();
  if (!session) redirect("/equipe/login");

  return <SchedulingPanel staffName={session.name} />;
}
