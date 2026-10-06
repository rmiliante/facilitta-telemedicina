/**
 * Níveis de acesso da equipe (login em /equipe/login) e o que cada um
 * pode ver/fazer. O médico tem login próprio (/medico) e fica fora daqui.
 *
 * Regras de sigilo:
 *  - quanto PAGAMOS ao médico (consult_fee / doctor_fee / repasse): só
 *    Master, Gestor e Financeiro;
 *  - quanto RECEBEMOS da prefeitura por consulta (contract_fee): nunca
 *    sai para o médico.
 *
 * Usado no proxy.ts (bloqueio no servidor) e no AdminPanel (menu).
 * Sem imports de Node: roda no proxy.
 */

export type StaffRole = "master" | "gestor" | "financeiro" | "prefeitura" | "atendente";

export const STAFF_ROLES: StaffRole[] = ["master", "gestor", "financeiro", "prefeitura", "atendente"];

export const ROLE_LABEL: Record<StaffRole, string> = {
  master: "Master",
  gestor: "Gestor",
  financeiro: "Financeiro",
  prefeitura: "Prefeitura",
  atendente: "Atendente",
};

export const ROLE_DESCRIPTION: Record<StaffRole, string> = {
  master: "Acesso total, inclusive equipe, auditoria e valores.",
  gestor: "Agenda, pacientes, histórico, relatórios e financeiro (só consulta). Sem cadastro de médicos, especialidades e captação.",
  financeiro: "Financeiro (repasse, fechamento, NF), histórico e relatórios com valores. Sem dados clínicos.",
  prefeitura: "Só consulta: dashboard e relatórios com faturamento. Sem dados de pacientes e sem valores pagos aos médicos.",
  atendente: "Painel de atendimento: agenda, pacientes e fila.",
};

/** Converte o papel gravado (inclui o antigo "admin" = Master). */
export function normalizeRole(value: unknown): StaffRole | null {
  if (value === "admin") return "master";
  return STAFF_ROLES.includes(value as StaffRole) ? (value as StaffRole) : null;
}

export type AdminTab =
  | "dashboard"
  | "agenda"
  | "historico"
  | "financeiro"
  | "relatorios"
  | "pacientes"
  | "medicos"
  | "captacao"
  | "especialidades"
  | "manuais"
  | "equipe"
  | "auditoria";

/** Telas do /admin por nível (o atendente usa o /atendente). */
export const ROLE_TABS: Record<StaffRole, AdminTab[]> = {
  master: ["dashboard", "agenda", "historico", "financeiro", "relatorios", "pacientes", "medicos", "captacao", "especialidades", "manuais", "equipe", "auditoria"],
  gestor: ["dashboard", "agenda", "historico", "financeiro", "relatorios", "pacientes"],
  financeiro: ["dashboard", "historico", "financeiro", "relatorios"],
  prefeitura: ["dashboard", "relatorios"],
  atendente: [],
};

/** Pode abrir o /admin (o atendente vai para o /atendente). */
export function canUseAdmin(role: StaffRole) {
  return ROLE_TABS[role].length > 0;
}

/** Vê quanto pagamos ao médico (valor por consulta, repasse). */
export function canSeeDoctorPay(role: StaffRole) {
  return role === "master" || role === "gestor" || role === "financeiro";
}

/** Vê nomes e fichas de pacientes. */
export function canSeePatients(role: StaffRole) {
  return role === "master" || role === "gestor" || role === "atendente";
}

/** Só leitura no Financeiro (não fecha mês, não paga, não anexa). */
export function financeReadOnly(role: StaffRole) {
  return role === "gestor";
}

const isRead = (method: string) => method === "GET" || method === "HEAD";
const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** Quais rotas de /api/admin/** cada nível pode chamar. */
export function apiAllowed(role: StaffRole, pathname: string, method: string): boolean {
  if (role === "master") return true;

  // Listas de médicos e especialidades (só leitura) alimentam filtros e
  // agendamento. A rota de médicos devolve só nome/especialidade para
  // quem não é Master.
  const lists =
    isRead(method) && (pathname === "/api/admin/doctors" || pathname === "/api/admin/specialties");

  switch (role) {
    case "atendente":
      return lists || under(pathname, "/api/admin/patients") || under(pathname, "/api/admin/appointments");
    case "gestor":
      return (
        lists ||
        under(pathname, "/api/admin/patients") ||
        under(pathname, "/api/admin/appointments") ||
        (isRead(method) &&
          (under(pathname, "/api/admin/dashboard") ||
            under(pathname, "/api/admin/historico") ||
            under(pathname, "/api/admin/relatorios") ||
            under(pathname, "/api/admin/financeiro")))
      );
    case "financeiro":
      return (
        lists ||
        under(pathname, "/api/admin/financeiro") ||
        (isRead(method) &&
          (under(pathname, "/api/admin/dashboard") ||
            under(pathname, "/api/admin/historico") ||
            under(pathname, "/api/admin/relatorios")))
      );
    case "prefeitura":
      return isRead(method) && (under(pathname, "/api/admin/dashboard") || under(pathname, "/api/admin/relatorios"));
  }
}

/** Cabeçalho que o proxy grava com o nível de quem chamou (nunca vem do navegador). */
export const STAFF_ROLE_HEADER = "x-facilitta-staff-role";
