import { redirect } from "next/navigation";
import { getDoctorSession } from "@/lib/auth";
import DoctorShell from "@/components/DoctorShell";
import DoctorFinanceClient from "@/components/DoctorFinanceClient";

/** Extrato financeiro do médico: a receber, recebido e cada fechamento. */
export default async function DoctorFinancePage() {
  const session = await getDoctorSession();
  if (!session) redirect("/medico/login");

  return (
    <DoctorShell doctorName={session.name}>
      <DoctorFinanceClient />
    </DoctorShell>
  );
}
