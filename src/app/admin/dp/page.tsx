import { headers } from "next/headers";
import DpClient from "@/components/DpClient";
import { normalizeRole, STAFF_ROLE_HEADER } from "@/lib/permissions";

/** Departamento Pessoal — só Master (ou acesso de recuperação, que equivale a Master). */
export default async function DpPage() {
  const raw = (await headers()).get(STAFF_ROLE_HEADER);
  const role = normalizeRole(raw);
  if (raw && role !== "master") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg px-4">
        <p className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600">
          Esta área é restrita ao Master (dados sensíveis de colaboradores).
        </p>
      </div>
    );
  }
  return <DpClient />;
}
