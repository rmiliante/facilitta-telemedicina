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
