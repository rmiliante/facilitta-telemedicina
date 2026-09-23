import { redirect, notFound } from "next/navigation";
import { getDoctorSession } from "@/lib/auth";
import { getOwnedAppointment, getPatientHistory } from "@/lib/appointments";
import ConsultationClient from "@/components/ConsultationClient";

export default async function ConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getDoctorSession();
  if (!session) redirect("/medico/login");

  const { id } = await params;
  const appointment = await getOwnedAppointment(id, session.doctorId);
  if (!appointment) notFound();

  const history = await getPatientHistory(appointment.patient_id, id);

  return (
    <ConsultationClient
      appointmentId={id}
      initialAppointment={appointment}
      initialHistory={history}
    />
  );
}
