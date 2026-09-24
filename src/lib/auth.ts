import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "facilitta_doctor_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12 horas

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Faltando SESSION_SECRET nas variáveis de ambiente.");
  }
  return new TextEncoder().encode(secret);
}

export interface DoctorSession {
  doctorId: string;
  name: string;
  email: string;
}

/** Cria o cookie de sessão assinado (JWT) pro médico logado. */
export async function createDoctorSession(session: DoctorSession) {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearDoctorSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** Lê e valida a sessão do médico a partir do cookie, se houver. */
export async function getDoctorSession(): Promise<DoctorSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.doctorId === "string" &&
      typeof payload.name === "string" &&
      typeof payload.email === "string"
    ) {
      return { doctorId: payload.doctorId, name: payload.name, email: payload.email };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Versão pra uso no proxy.ts (edge runtime) — recebe o token direto
 * (lido do header de cookie) em vez de usar next/headers.
 */
export async function verifyDoctorToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecretKey());
    return true;
  } catch {
    return false;
  }
}

export const DOCTOR_COOKIE_NAME = COOKIE_NAME;

// ------------------------------------------------------------
// Sessão da equipe (admin / atendente)
// ------------------------------------------------------------
const STAFF_COOKIE_NAME = "facilitta_staff_session";

export interface StaffSession {
  staffId: string;
  name: string;
  email: string;
  role: "admin" | "atendente";
}

/** Cria o cookie de sessão assinado (JWT) pra equipe (admin/atendente). */
export async function createStaffSession(session: StaffSession) {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(STAFF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearStaffSession() {
  const cookieStore = await cookies();
  cookieStore.delete(STAFF_COOKIE_NAME);
}

/** Lê e valida a sessão da equipe a partir do cookie, se houver. */
export async function getStaffSession(): Promise<StaffSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_COOKIE_NAME)?.value;
  if (!token) return null;
  return parseStaffToken(token);
}

function parseStaffPayload(payload: Record<string, unknown>): StaffSession | null {
  if (
    typeof payload.staffId === "string" &&
    typeof payload.name === "string" &&
    typeof payload.email === "string" &&
    (payload.role === "admin" || payload.role === "atendente")
  ) {
    return {
      staffId: payload.staffId,
      name: payload.name,
      email: payload.email,
      role: payload.role,
    };
  }
  return null;
}

async function parseStaffToken(token: string): Promise<StaffSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return parseStaffPayload(payload);
  } catch {
    return null;
  }
}

/**
 * Versão pra uso no proxy.ts (edge runtime) — recebe o token direto
 * (lido do header de cookie) e devolve a sessão (ou null).
 */
export async function verifyStaffToken(token: string): Promise<StaffSession | null> {
  return parseStaffToken(token);
}

export const STAFF_SESSION_COOKIE_NAME = STAFF_COOKIE_NAME;
