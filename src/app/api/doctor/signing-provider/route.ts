import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { getCertificate } from "@/lib/certificateProviders";
import { clearSigningSession, getSigningDoctor, saveSigningProvider } from "@/lib/doctorSigning";

/**
 * PUT /api/doctor/signing-provider — médico escolhe qual certificado vincula
 * (vidaas, birdid...). Body: { provider }. Trocar de certificado derruba a
 * sessão atual, porque a aprovação é de outro aplicativo.
 */
export async function PUT(req: NextRequest) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const cert = getCertificate(typeof body?.provider === "string" ? body.provider : null);
  if (!cert) return NextResponse.json({ error: "Certificado desconhecido" }, { status: 400 });

  const doctor = await getSigningDoctor(session.doctorId);
  if (!doctor) return NextResponse.json({ error: "Médico não encontrado" }, { status: 404 });

  const changed = doctor.signing_provider !== cert.id;
  const saved = await saveSigningProvider(doctor.id, cert.id);
  if (saved && changed && doctor.signing_provider) await clearSigningSession(doctor.id);
  return NextResponse.json({
    ok: true,
    saved,
    provider: { id: cert.id, label: cert.label, appName: cert.appName, approval: cert.approval },
    ...(saved ? {} : { warning: "A escolha ainda não pôde ser guardada (falta atualizar o banco). Avise a administração." }),
  });
}
