import { headers } from "next/headers";
import { getDoctorSession, getStaffSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { StaffRole } from "@/lib/permissions";

/**
 * Registro de auditoria (LGPD): quem viu ou alterou dados de pacientes,
 * consultas, documentos, cadastros e financeiro — e quando, de onde.
 * Nunca derruba a ação do usuário: se gravar o registro falhar, só loga.
 */

export const AUDIT_ACTIONS = {
  login_ok: "Login",
  login_falhou: "Login recusado",
  login_bloqueado: "Login bloqueado (muitas tentativas)",
  troca_senha: "Troca de senha",
  troca_senha_falhou: "Troca de senha recusada (senha atual incorreta)",
  ver_paciente: "Abriu cadastro do paciente",
  ver_historico: "Abriu histórico do paciente",
  ver_documentos: "Abriu documentos do paciente",
  ver_consulta: "Abriu consulta (prontuário)",
  criar_paciente: "Cadastrou paciente",
  editar_paciente: "Alterou cadastro do paciente",
  excluir_paciente: "Excluiu paciente",
  unificar_paciente: "Unificou cadastros repetidos",
  anexar_documento: "Anexou documento",
  remover_documento: "Removeu documento",
  imprimir_documento: "Marcou documento como impresso",
  emitir_documento: "Emitiu documento assinado",
  registrar_afericao: "Registrou sinais vitais",
  excluir_afericao: "Excluiu sinais vitais",
  agendar_consulta: "Agendou consulta",
  alterar_consulta: "Alterou consulta",
  excluir_consulta: "Excluiu consulta",
  salvar_consulta: "Salvou anotações/status da consulta",
  cadastrar_medico: "Cadastrou médico",
  alterar_medico: "Alterou cadastro de médico",
  excluir_medico: "Excluiu médico",
  cadastrar_equipe: "Cadastrou membro da equipe",
  alterar_equipe: "Alterou membro da equipe",
  excluir_equipe: "Excluiu membro da equipe",
  fechar_repasse: "Fechou repasse do médico",
  reabrir_repasse: "Reabriu fechamento",
  pagar_repasse: "Registrou pagamento",
  desfazer_pagamento: "Desfez pagamento",
  anexar_comprovante: "Anexou comprovante de pagamento",
  anexar_nf: "Anexou nota fiscal",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export interface AuditActor {
  type: StaffRole | "admin" | "admin_recuperacao" | "medico" | "anonimo";
  id: string | null;
  name: string;
}

export interface AuditEntry {
  action: AuditAction;
  entity?: string;
  entityId?: string | null;
  patientId?: string | null;
  patientName?: string | null;
  details?: Record<string, unknown>;
  /** Quem fez, quando já se sabe (ex.: login). Senão vem da sessão. */
  actor?: AuditActor;
}

/** Quem está fazendo a requisição: sessão da equipe, do médico ou o acesso de recuperação. */
export async function currentActor(scope: "staff" | "doctor"): Promise<AuditActor> {
  if (scope === "doctor") {
    const doctor = await getDoctorSession();
    return doctor ? { type: "medico", id: doctor.doctorId, name: doctor.name } : { type: "anonimo", id: null, name: "—" };
  }
  const staff = await getStaffSession();
  if (staff) return { type: staff.role, id: staff.staffId, name: staff.name };
  // Sem cookie da equipe, o proxy só deixou passar com o usuário/senha de recuperação.
  return { type: "admin_recuperacao", id: null, name: "Admin (acesso de recuperação)" };
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return (forwarded ? forwarded.split(",")[0].trim() : h.get("x-real-ip")) || null;
}

/** Grava o registro. `scope` diz de onde tirar o autor se `entry.actor` não vier. */
export async function audit(scope: "staff" | "doctor", entry: AuditEntry): Promise<void> {
  try {
    const actor = entry.actor ?? (await currentActor(scope));
    const { error } = await getSupabaseAdmin()
      .from("audit_log")
      .insert({
        actor_type: actor.type,
        actor_id: actor.id,
        actor_name: actor.name,
        action: entry.action,
        entity: entry.entity ?? null,
        entity_id: entry.entityId ?? null,
        patient_id: entry.patientId ?? null,
        patient_name: entry.patientName ?? null,
        details: entry.details ?? null,
        ip: await clientIp(),
      });
    // Tabela ainda não criada (migração pendente): não atrapalha o uso.
    if (error && error.code !== "42P01" && error.code !== "PGRST205") {
      console.error("Falha ao gravar auditoria:", error.message);
    }
  } catch (err) {
    console.error("Falha ao gravar auditoria:", err);
  }
}

/** Nome do paciente pra deixar o registro legível mesmo se o cadastro for apagado depois. */
export async function patientName(patientId: string | null | undefined): Promise<string | null> {
  if (!patientId) return null;
  const { data } = await getSupabaseAdmin().from("patients").select("full_name").eq("id", patientId).maybeSingle();
  return (data as { full_name?: string } | null)?.full_name ?? null;
}

/** Paciente de uma consulta (pra registrar ações feitas pela consulta). */
export async function appointmentPatient(appointmentId: string): Promise<{ id: string | null; name: string | null }> {
  const { data } = await getSupabaseAdmin()
    .from("appointments")
    .select("patient_id, patients(full_name)")
    .eq("id", appointmentId)
    .maybeSingle();
  const row = data as { patient_id?: string; patients?: { full_name?: string } | null } | null;
  return { id: row?.patient_id ?? null, name: row?.patients?.full_name ?? null };
}

// ------------------------------------------------------------
// Limite de tentativas de login (usa o próprio registro de auditoria).
// ------------------------------------------------------------
const WINDOW_MINUTES = 15;
const MAX_FAILS_PER_EMAIL = 5;
const MAX_FAILS_PER_IP = 20;

/** true = bloquear: muitas senhas erradas recentes pra esse e-mail ou IP. */
export async function loginLocked(email: string): Promise<boolean> {
  try {
    const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
    const supabase = getSupabaseAdmin();
    const ip = await clientIp();
    const byEmail = supabase
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "login_falhou")
      .eq("entity_id", email)
      .gte("at", since);
    const byIp = ip
      ? supabase.from("audit_log").select("id", { count: "exact", head: true }).eq("action", "login_falhou").eq("ip", ip).gte("at", since)
      : null;
    const [emailRes, ipRes] = await Promise.all([byEmail, byIp]);
    if (emailRes.error) return false; // sem a tabela, não bloqueia
    return (emailRes.count ?? 0) >= MAX_FAILS_PER_EMAIL || (ipRes?.count ?? 0) >= MAX_FAILS_PER_IP;
  } catch {
    return false;
  }
}

export const LOGIN_LOCKED_MESSAGE = `Muitas tentativas com senha errada. Aguarde ${WINDOW_MINUTES} minutos e tente de novo.`;
