import { getSupabaseAdmin } from "@/lib/supabase";
import { addGeneratedPatientDocument } from "@/lib/patientDocuments";
import { urlDocumento, PrescricoesError } from "@/lib/prescrevePrescricoes";
import { clearDoctorBearer, getDoctorBearer } from "@/lib/prescreveToken";

const PREFIXO: Record<string, string> = { receita: "Receita", exame: "Pedido de exame", atestado: "Atestado" };

/**
 * Documentos que a Prescreve emitiu mas cujo PDF não pôde ser baixado (médico sem token na hora).
 * Com o token do médico em mãos, baixa e salva no cadastro do paciente. Nunca derruba quem chamou.
 * Devolve quantos PDFs foram recuperados.
 */
export async function recuperarPdfsPendentes(doctorId: string): Promise<number> {
  try {
    const bearer = await getDoctorBearer(doctorId);
    if (!bearer) return 0;
    const supabase = getSupabaseAdmin();
    const { data: pend } = await supabase
      .from("prescreve_documentos")
      .select("id, consulta_ref, paciente_nome, tipo_controle, token, created_at")
      .eq("doctor_id", doctorId)
      .eq("status", "emitido_sem_pdf")
      .not("token", "is", null)
      .order("created_at", { ascending: true })
      .limit(20);
    if (!pend?.length) return 0;
    const { data: doc } = await supabase.from("doctors").select("name").eq("id", doctorId).maybeSingle();

    let n = 0;
    for (const p of pend) {
      try {
        const { data: appt } = await supabase.from("appointments").select("patient_id").eq("id", p.consulta_ref).maybeSingle();
        if (!appt?.patient_id) continue;
        const { url } = await urlDocumento(p.token as string, bearer);
        const pdfRes = await fetch(url);
        if (!pdfRes.ok) continue;
        const buf = Buffer.from(await pdfRes.arrayBuffer());
        const dia = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" })
          .format(new Date(p.created_at as string))
          .replace(/\//g, "-");
        const kind = (p.tipo_controle as "receita" | "exame" | "atestado") in PREFIXO ? (p.tipo_controle as "receita" | "exame" | "atestado") : "exame";
        const saved = await addGeneratedPatientDocument(appt.patient_id as string, buf, `${PREFIXO[kind]} - ${p.paciente_nome} - ${dia}.pdf`, {
          kind,
          signed: true,
          author: (doc?.name as string) ?? "",
          appointment_id: p.consulta_ref as string,
          needs_print: true,
        });
        await supabase.from("prescreve_documentos").update({ pdf_path: saved.path, status: "emitido" }).eq("id", p.id);
        n++;
      } catch (e) {
        if (e instanceof PrescricoesError && e.status === 401) {
          await clearDoctorBearer(doctorId);
          break;
        }
        console.error("Prescrições: não consegui recuperar um PDF", e);
      }
    }
    return n;
  } catch (e) {
    console.error("Prescrições: falha na recuperação de PDFs", e);
    return 0;
  }
}
