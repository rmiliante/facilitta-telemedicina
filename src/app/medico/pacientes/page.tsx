import { redirect } from "next/navigation";
import { getDoctorSession } from "@/lib/auth";
import DoctorShell from "@/components/DoctorShell";
import DoctorPatientsClient from "@/components/DoctorPatientsClient";

/**
 * Pacientes do médico fora de consulta: abre o cadastro, edita (com
 * confirmação) e anexa documentos.
 */
export default async function DoctorPatientsPage() {
  const session = await getDoctorSession();
  if (!session) redirect("/medico/login");

  return (
    <DoctorShell doctorName={session.name}>
      <DoctorPatientsClient />
    </DoctorShell>
  );
}
