import { timingSafeEqual } from "node:crypto";
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
//  - /atendimento   e /api/booth/**         → sem login (link único,
//    fixo e genérico da cabine de atendimento presencial), mas exige
//    a chave da cabine quando BOOTH_ACCESS_KEY está configurada.
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

/** Compara textos em tempo constante (não vaza, pelo tempo, quantos caracteres bateram). */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function checkStaffBasicAuth(request: NextRequest): boolean {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;

  // Sem variáveis configuradas, o acesso de recuperação fica DESLIGADO
  // (antes liberava o /admin inteiro pra qualquer um). O login normal
  // da equipe em /equipe/login continua funcionando.
  if (!user || !password) return false;

  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) return false;

  const decoded = Buffer.from(authHeader.slice("Basic ".length).trim(), "base64").toString("utf-8");
  // Separa só no primeiro ":" — a senha pode conter ":".
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  const providedUser = decoded.slice(0, sep);
  const providedPassword = decoded.slice(sep + 1);
  return safeEqual(providedUser, user) && safeEqual(providedPassword, password);
}

// ------------------------------------------------------------
// Cabine (/atendimento): link sem login, mas protegido por uma chave
// opcional (BOOTH_ACCESS_KEY). A rota /api/booth/current devolve o
// token de acesso da consulta em andamento — sem a chave, qualquer
// pessoa na internet conseguia pegar esse token e entrar na
// videochamada do paciente. Com a chave configurada, abra uma vez no
// computador da cabine /atendimento?chave=SUA_CHAVE: a chave fica
// guardada num cookie e o endereço volta a ser só /atendimento.
// ------------------------------------------------------------
const BOOTH_COOKIE_NAME = "facilitta_booth_key";
const BOOTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano

function handleBooth(request: NextRequest): NextResponse {
  const key = process.env.BOOTH_ACCESS_KEY;
  if (!key) {
    console.warn(
      "Cabine sem proteção: configure BOOTH_ACCESS_KEY para impedir que estranhos peguem o link da consulta em andamento."
    );
    return NextResponse.next();
  }

  const { pathname, searchParams } = request.nextUrl;
  const fromQuery = searchParams.get("chave");
  if (pathname === "/atendimento" && fromQuery && safeEqual(fromQuery, key)) {
    const cleanUrl = new URL("/atendimento", request.url);
    const response = NextResponse.redirect(cleanUrl);
    response.cookies.set(BOOTH_COOKIE_NAME, key, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: BOOTH_COOKIE_MAX_AGE,
    });
    return response;
  }

  const fromCookie = request.cookies.get(BOOTH_COOKIE_NAME)?.value;
  if (fromCookie && safeEqual(fromCookie, key)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Cabine não autorizada" }, { status: 403 });
  }
  return new NextResponse(
    "Cabine não autorizada. Abra o endereço com a chave da cabine (/atendimento?chave=...).",
    { status: 403, headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
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

  if (
    pathname === "/atendimento" ||
    pathname.startsWith("/atendimento/") ||
    pathname.startsWith("/api/booth")
  ) {
    return handleBooth(request);
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
