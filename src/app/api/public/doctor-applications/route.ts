import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BRAZIL_STATES, uploadApplicationPhoto } from "@/lib/doctorApplications";
import { normalizeSpecialty, specializationsOf } from "@/lib/specialtyNormalize";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A Vercel recusa requisições acima de ~4,5 MB antes de chegar aqui,
// então o limite da foto precisa ficar abaixo disso.
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/** POST /api/public/doctor-applications — cadastro publico de medicos interessados. */
export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Envio inválido. Tente novamente." }, { status: 400 });
  }

  // Honeypot: bots preenchem esse campo invisivel; humano nunca ve.
  const website = formData.get("website");
  if (typeof website === "string" && website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const name = String(formData.get("name") ?? "").trim();
  const crm = String(formData.get("crm") ?? "").trim();
  const crmUf = String(formData.get("crmUf") ?? "").trim().toUpperCase();
  const clip = (k: string, max = 200) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim().slice(0, max) : null;
  };
  const num = (k: string) => {
    const v = String(formData.get(k) ?? "").trim().replace(",", ".");
    const n = v === "" ? null : Number(v);
    return n !== null && Number.isFinite(n) && n >= 0 ? n : null;
  };
  const careModeRaw = String(formData.get("careMode") ?? "").trim();
  const careMode = ["consulta", "plantao", "ambos"].includes(careModeRaw) ? careModeRaw : null;
  const hasRqeRaw = String(formData.get("hasRqe") ?? "").trim();
  const hasRqe = hasRqeRaw === "sim" ? true : hasRqeRaw === "nao" ? false : null;
  const specialty = String(formData.get("specialty") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim().toUpperCase();

  if (!name || !specialty || !email || !whatsapp || !city || !state) {
    return NextResponse.json({ error: "Preencha todos os campos obrigatorios" }, { status: 400 });
  }

  if (!(BRAZIL_STATES as readonly string[]).includes(state)) {
    return NextResponse.json({ error: "Estado invalido" }, { status: 400 });
  }
  if (crmUf && !(BRAZIL_STATES as readonly string[]).includes(crmUf)) {
    return NextResponse.json({ error: "UF do CRM invalida" }, { status: 400 });
  }
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "E-mail invalido" }, { status: 400 });
  }

  const experienceYearsRaw = formData.get("experienceYears");
  const experienceYears =
    typeof experienceYearsRaw === "string" && experienceYearsRaw.trim() !== ""
      ? Number(experienceYearsRaw)
      : null;

  const consultPrice = num("consultPrice");
  const shiftPrice = num("shiftPrice");

  const availableDays = formData.getAll("availableDays").map((v) => String(v));
  const availableShifts = formData.getAll("availableShifts").map((v) => String(v));
  const presentationRaw = formData.get("presentation");
  const presentation =
    typeof presentationRaw === "string" && presentationRaw.trim() !== "" ? presentationRaw.trim() : null;

  let photoPath: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "A foto deve ter no maximo 4MB" }, { status: 400 });
    }
    if (!photo.type.startsWith("image/")) {
      return NextResponse.json({ error: "A foto deve ser uma imagem" }, { status: 400 });
    }
    try {
      photoPath = await uploadApplicationPhoto(photo);
    } catch (err) {
      console.error("Erro ao enviar foto:", err);
      return NextResponse.json({ error: "Falha ao enviar a foto" }, { status: 500 });
    }
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("doctor_applications").insert({
    name,
    crm: crm || null,
    crm_uf: crmUf || null,
    specialty: normalizeSpecialty("Médico(a)", specialty),
    specializations: specializationsOf("Médico(a)", specialty),
    specialty_raw: specialty,
    experience_years: experienceYears,
    email,
    whatsapp,
    city,
    state,
    consult_price: consultPrice,
    available_days: availableDays,
    available_shifts: availableShifts,
    presentation,
    photo_path: photoPath,
    status: "novo",
    care_mode: careMode,
    shift_price: shiftPrice,
    has_rqe: hasRqe,
    utm_source: clip("utmSource"),
    utm_medium: clip("utmMedium"),
    utm_campaign: clip("utmCampaign"),
    utm_content: clip("utmContent"),
    utm_term: clip("utmTerm"),
    referrer: clip("referrer", 300),
    device: clip("device", 20),
    session_id: clip("sessionId", 64),
  });

  if (error) {
    console.error("Erro ao salvar candidatura:", error);
    return NextResponse.json({ error: "Falha ao enviar seu cadastro" }, { status: 500 });
  }

  // Envio contado no servidor (confiável, não depende do navegador).
  const sessionId = clip("sessionId", 64);
  if (sessionId) {
    await supabase.from("captacao_events").insert({
      session_id: sessionId,
      event: "submit",
      utm_source: clip("utmSource"),
      utm_medium: clip("utmMedium"),
      utm_campaign: clip("utmCampaign"),
      utm_content: clip("utmContent"),
      utm_term: clip("utmTerm"),
      referrer: clip("referrer", 300),
      device: clip("device", 20),
    });
  }

  return NextResponse.json({ ok: true });
}
