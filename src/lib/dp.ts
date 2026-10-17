/**
 * Departamento Pessoal (DP): colaboradores CLT, admissão e alertas.
 * Só o Master acessa (ver proxy.ts / permissions.ts). Sem imports de Node.
 */

export type DpStatus = "admissao" | "experiencia" | "ativo" | "ferias" | "desligado";

export const DP_STATUS_LABEL: Record<DpStatus, string> = {
  admissao: "Admissão",
  experiencia: "Experiência",
  ativo: "Ativo",
  ferias: "Em férias",
  desligado: "Desligado",
};

export interface DpEmployee {
  id: string;
  full_name: string;
  cpf: string | null;
  role_title: string;
  department: string | null;
  admitted_at: string | null;
  salary: number | null;
  status: DpStatus;
  experience_end: string | null;
  vacation_due: string | null;
  vacation_return: string | null;
  aso_due: string | null;
  terminated_at: string | null;
  notes: string | null;
  esocial?: Record<string, string> | null;
}

export interface DpAdmissionItem {
  id: string;
  employee_id: string;
  label: string;
  sort: number;
  done: boolean;
  done_at: string | null;
}

export const DEFAULT_ADMISSION_CHECKLIST = [
  "Contrato de trabalho assinado",
  "Exame admissional (ASO) apto",
  "Dados bancários e PIS/CPF conferidos",
  "Opção de vale-transporte registrada",
  "Ficha de registro preenchida",
  "Evento de admissão enviado ao eSocial",
  "Carteira de Trabalho Digital conferida pelo colaborador",
  "Comprovante de residência",
  "Certidão de nascimento dos dependentes (salário-família)",
];

export const DP_STATUSES: DpStatus[] = ["admissao", "experiencia", "ativo", "ferias", "desligado"];

/** Custo mensal estimado: salário + FGTS 8% + provisão de 13º + férias com 1/3 + FGTS sobre as provisões. INSS patronal fica no DAS (Simples Nacional). */
export function monthlyCost(salary: number | null | undefined) {
  const s = Number(salary) || 0;
  const fgts = s * 0.08;
  const decimo = s / 12;
  const ferias = (s / 12) * (4 / 3);
  const fgtsProv = (decimo + ferias) * 0.08;
  return { salary: s, fgts, decimo, ferias, fgtsProv, total: s + fgts + decimo + ferias + fgtsProv };
}

/** Dias até a data (negativo = vencida). */
export function daysUntil(date: string | null | undefined, today = new Date()): number | null {
  if (!date) return null;
  const d = new Date(`${date.slice(0, 10)}T12:00:00`);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}

export interface DpAlert {
  level: "urgente" | "atencao" | "info";
  title: string;
  detail: string;
  employeeId: string;
  days: number | null;
}

/** Alertas de vencimentos (experiência, ASO, férias) e admissões pendentes. */
export function buildAlerts(
  employees: DpEmployee[],
  pendingByEmployee: Record<string, number>,
  today = new Date(),
): DpAlert[] {
  const out: DpAlert[] = [];
  for (const e of employees) {
    if (e.status === "desligado") continue;
    const exp = daysUntil(e.experience_end, today);
    if (e.status === "experiencia" && exp !== null && exp <= 30) {
      out.push({
        level: exp <= 10 ? "urgente" : "atencao",
        title: exp < 0 ? `Experiência venceu há ${-exp} dias` : `Contrato de experiência termina em ${exp} dias`,
        detail: `${e.full_name} · decidir efetivação`,
        employeeId: e.id,
        days: exp,
      });
    }
    const aso = daysUntil(e.aso_due, today);
    if (aso !== null && aso <= 30) {
      out.push({
        level: aso < 0 ? "urgente" : "atencao",
        title: aso < 0 ? `ASO vencido há ${-aso} dias` : `ASO periódico vence em ${aso} dias`,
        detail: `${e.full_name} · agendar exame`,
        employeeId: e.id,
        days: aso,
      });
    }
    const fer = daysUntil(e.vacation_due, today);
    if (e.status !== "ferias" && fer !== null && fer <= 60) {
      out.push({
        level: fer < 0 ? "urgente" : "atencao",
        title: fer < 0 ? `Férias vencidas há ${-fer} dias` : `Férias vencem em ${fer} dias`,
        detail: `${e.full_name} · programar período`,
        employeeId: e.id,
        days: fer,
      });
    }
    const pend = pendingByEmployee[e.id] ?? 0;
    if (e.status === "admissao" && pend > 0) {
      out.push({
        level: "info",
        title: "Admissão pendente de documentos",
        detail: `${e.full_name} · faltam ${pend} itens`,
        employeeId: e.id,
        days: null,
      });
    }
  }
  const order = { urgente: 0, atencao: 1, info: 2 } as const;
  return out.sort((a, b) => order[a.level] - order[b.level] || (a.days ?? 9999) - (b.days ?? 9999));
}
