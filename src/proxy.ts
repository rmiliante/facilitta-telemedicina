import { NextRequest, NextResponse } from "next/server";
import {
  verifyDoctorToken,
  verifyStaffToken,
  DOCTOR_COOKIE_NAME,
  STAFF_SESSION_COOKIE_NAME,
  type StaffSession,
} from "@/lib/auth";

// Nota: no Next.js 16, o antigo "middleware.ts" foi renomeado para
// "proxy.ts" (a função também se chama `proxy`, não `middleware`).
//
// Áreas com regras de acesso diferentes:
//  - /paciente/**  e  /api/appointments/**  → público (o token da
//    própria consulta é validado dentro da rota).
//  - /cabine/**    e  /api/booth/**         → público (link fixo e
//    não divulgado da cabine de atendimento presencial, por médico).
//  - /medico/**    e  /api/doctor/**        → exige sessão de médico
//    (cookie JWT, criado no login).
//  - /equipe/login                          → público (login da
//    equipe: admin e atendente).
//  - /admin/**     e  /api/admin/**         → exige sessão de admin
//    (cookie da equipe com role=admin) OU usuário/senha via HTTP
//    Basic Auth (superusuário de recuperação, variáveis de ambiente).
//  - /atendente/** e o SUBCONJUNTO de /api/admin/** relacionado a
//    pacientes/consultas → também aceita sessão com role=atendente.

function unauthorizedBasic() {
  return new NextResponse("Autenticação necessária", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Administração Facilitta"' },
  });
}

function checkStaffBasicAuth(request: NextRequest): boolean {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;

  // Sem variáveis configuradas, não bloqueia (evita travar o app se
  // esquecerem de configurar em algum ambiente) — mas configure sempre!
  if (!user || !password) return true;

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;

  const decoded = Buffer.from(authHeader.split(" ")[1], "base64").toString("utf-8");
  const [providedUser, providedPassword] = decoded.split(":");
  return providedUser === user && providedPassword === password;
}

async function getStaffFromCookie(request: NextRequest): Promise<StaffSession | null> {
  const token = request.cookies.get(STAFF_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyStaffToken(token);
}

/**
 * Endpoints de /api/admin/** que um atendente também pode usar —
 * doctors/specialties só em modo leitura (pra popular os selects do
 * formulário de agendamento e da fila), pacientes/consultas livre.
 */
function atendenteCanAccess(pathname: string, method: string): boolean {
  if (pathname.startsWith("/api/admin/patients")) return true;
  if (pathname.startsWith("/api/admin/appointments")) return true;
  if (pathname.startsWith("/api/admin/doctors")) return method === "GET";
  if (pathname.startsWith("/api/admin/specialties")) return method === "GET";
  return false;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  if (pathname === "/equipe/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const staff = await getStaffFromCookie(request);
    if (staff?.role === "admin") return NextResponse.next();
    if (checkStaffBasicAuth(request)) return NextResponse.next();

    if (staff?.role === "atendente" && pathname.startsWith("/api/admin")) {
      if (atendenteCanAccess(pathname, method)) return NextResponse.next();
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }

    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    return unauthorizedBasic();
  }

  if (pathname.startsWith("/atendente")) {
    const staff = await getStaffFromCookie(request);
    if (staff?.role === "atendente" || staff?.role === "admin") return NextResponse.next();

    const loginUrl = new URL("/equipe/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/medico") || pathname.startsWith("/api/doctor")) {
    // A própria página de login do médico não exige sessão.
    if (pathname === "/medico/login") return NextResponse.next();

    const token = request.cookies.get(DOCTOR_COOKIE_NAME)?.value;
    const valid = token ? await verifyDoctorToken(token) : false;

    if (!valid) {
      if (pathname.startsWith("/api/doctor")) {
        return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
      }
      const loginUrl = new URL("/medico/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
