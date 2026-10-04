import { headers } from "next/headers";
import AdminPanel from "@/components/AdminPanel";
import { normalizeRole, STAFF_ROLE_HEADER } from "@/lib/permissions";

export default async function AdminPage() {
  // O proxy só deixa chegar aqui com sessão válida e grava o nível.
  const role = normalizeRole((await headers()).get(STAFF_ROLE_HEADER)) ?? "prefeitura";
  return <AdminPanel role={role} />;
}
