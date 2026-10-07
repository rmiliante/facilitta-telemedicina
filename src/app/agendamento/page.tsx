import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth";
import SchedulingPanel from "@/components/SchedulingPanel";

export default async function AgendamentoPage() {
  const session = await getStaffSession();
  if (!session) redirect("/equipe/login");

  return <SchedulingPanel staffName={session.name} />;
}
