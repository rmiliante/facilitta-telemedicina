import { redirect } from "next/navigation";
import { getDoctorSession } from "@/lib/auth";
import DoctorShell from "@/components/DoctorShell";
import SigningAccountClient from "@/components/SigningAccountClient";

/** Minha assinatura digital: ativa a conta de assinatura (CRM gravado na assinatura), uma vez só. */
export default async function DoctorSigningPage() {
  const session = await getDoctorSession();
  if (!session) redirect("/medico/login");

  return (
    <DoctorShell doctorName={session.name}>
      <SigningAccountClient />
    </DoctorShell>
  );
}
