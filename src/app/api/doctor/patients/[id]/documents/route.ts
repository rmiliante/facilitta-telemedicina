import { NextRequest, NextResponse } from "next/server";
import { getDoctorSession } from "@/lib/auth";
import { doctorCanAccessPatient } from "@/lib/appointments";
import {
  addPatientDocuments,
  removePatientDocument,
  signPatientDocuments,
  type PatientDocument,
} from "@/lib/patientDocuments";
import { getSupabaseAdmin } from "@/lib/supabase";
import { audit, patientName } from "@/lib/audit";

/**
 * Documentos do paciente vistos/anexados pelo médico — mesmo repositório
 * usado pela atendente (ligado ao paciente, não a uma consulta). Serve
 * pro médico anexar pedidos de exame, que ficam disponíveis pra
 * atendente abrir/imprimir depois.
 */

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  if (!(await doctorCanAccessPatient(session.doctorId, id))) {
    return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("patients")
    .select("documents")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
  }

  const files = await signPatientDocuments((data.documents as PatientDocument[] | null) ?? []);
  await audit("doctor", { action: "ver_documentos", entity: "paciente", entityId: id, patientId: id, patientName: await patientName(id) });
  return NextResponse.json({ files });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  if (!(await doctorCanAccessPatient(session.doctorId, id))) {
    return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
  }
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Envie os arquivos como multipart/form-data" }, { status: 400 });
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  try {
    const updated = await addPatientDocuments(id, files, { source: "medico" });
    const signed = await signPatientDocuments(updated);
    await audit("doctor", { action: "anexar_documento", entity: "documento", patientId: id, patientName: await patientName(id), details: { arquivos: files.map((f) => f.name) } });
    return NextResponse.json({ files: signed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao anexar documento" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getDoctorSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  if (!(await doctorCanAccessPatient(session.doctorId, id))) {
    return NextResponse.json({ error: "Paciente não encontrado" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const { path } = body ?? {};

  if (typeof path !== "string" || !path) {
    return NextResponse.json({ error: "path é obrigatório" }, { status: 400 });
  }

  try {
    const updated = await removePatientDocument(id, path);
    const signed = await signPatientDocuments(updated);
    await audit("doctor", { action: "remover_documento", entity: "documento", entityId: path, patientId: id, patientName: await patientName(id) });
    return NextResponse.json({ files: signed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao remover documento" },
      { status: 500 }
    );
  }
}
