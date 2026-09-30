import { NextRequest, NextResponse } from "next/server";
import { getSigningDoctor } from "@/lib/doctorSigning";
import { discoverCertificate, PrescreveError } from "@/lib/prescreve";

/**
 * GET /api/admin/doctors/:id/certificate
 * Confere se o CPF do médico tem certificado digital em nuvem (VIDaaS ou
 * BirdID) disponível — mostra no cadastro antes de ele tentar assinar.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const doctor = await getSigningDoctor(id);
    if (!doctor) return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });
    if (!doctor.cpf || doctor.cpf.replace(/\D/g, "").length !== 11) {
      return NextResponse.json({ status: "sem_cpf" });
    }
    const info = await discoverCertificate(doctor.cpf);
    return NextResponse.json({
      status: info.can_sign ? "ok" : "nenhum",
      providers: info.providers ?? [],
      preferred: info.preferred_provider ?? null,
    });
  } catch (err) {
    const message = err instanceof PrescreveError ? err.message : "Falha ao verificar o certificado";
    return NextResponse.json({ status: "erro", error: message }, { status: 200 });
  }
}
