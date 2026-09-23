import { NextRequest, NextResponse } from "next/server";
import { verifyDoctorToken, DOCTOR_COOKIE_NAME } from "@/lib/auth";

// Nota: no Next.js 16, o antigo "middleware.ts" foi renomeado para
// "proxy.ts" (a função também se chama `proxy`, não `middleware`).
//
// Três áreas com regras de acesso diferentes:
//  - /paciente/**  e  /api/appointments/**  → público (o token da
//    própria consulta é validado dentro da rota).
//  - /medico/**    e  /api/doctor/**        → exige sessão de médico
//    (cookie JWT, criado no login).
//  - /admin/**     e  /api/admin/**         → exige usuário/senha da
//    equipe (HTTP Basic Auth), igual ao painel do CRM.

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

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!checkStaffBasicAuth(request)) return unauthorizedBasic();
    return NextResponse.next();
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
