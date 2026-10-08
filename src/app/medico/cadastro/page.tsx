import { redirect } from "next/navigation";
import { getDoctorSession } from "@/lib/auth";
import DoctorShell from "@/components/DoctorShell";
import DoctorProfileClient from "@/components/DoctorProfileClient";
import DoctorPasswordForm from "@/components/DoctorPasswordForm";

/** Meu cadastro: o médico confere os dados e completa RQE e endereço profissional. */
export default async function DoctorProfilePage() {
  const session = await getDoctorSession();
  if (!session) redirect("/medico/login");

  return (
    <DoctorShell doctorName={session.name}>
      <DoctorProfileClient />
      <DoctorPasswordForm />
    </DoctorShell>
  );
}
