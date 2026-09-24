import { NextResponse } from "next/server";
import { clearDoctorSession, clearStaffSession } from "@/lib/auth";

export async function POST() {
  await clearDoctorSession();
  await clearStaffSession();
  return NextResponse.json({ ok: true });
}
