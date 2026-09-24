import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth";
import StaffPanel from "@/components/StaffPanel";

export default async function AtendentePage() {
  const session = await getStaffSession();
  if (!session) redirect("/equipe/login");

  return <StaffPanel staffName={session.name} />;
}
