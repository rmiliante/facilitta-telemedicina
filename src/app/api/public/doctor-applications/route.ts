import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BRAZIL_STATES, uploadApplicationPhoto } from "@/lib/doctorApplications";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** POST /api/public/doctor-applications — cadastro publico de medicos interessados. */
export async function POST(req: NextRequest) {
  const formData = await req.formData();

  // Honeypot: bots preenchem esse campo invisivel; humano nunca ve.
  const website = formData.get("website");
  if (typeof website === "string" && website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const name = String(formData.get("name") ?? "").trim();
  const crm = String(formData.get("crm") ?? "").trim();
  const crmUf = String(formData.get("crmUf") ?? "").trim().toUpperCase();
  const specialty = String(formData.get("specialty") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const whatsapp = String(formData.get("whatsapp") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim().toUpperCase();

  if (!name || !crm || !crmUf || !specialty || !email || !whatsapp || !city || !state) {
    return NextResponse.json({ error: "Preencha todos os campos obrigatorios" }, { status: 400 });
  }

  if (!(BRAZIL_STATES as readonly string[]).includes(state)) {
    return NextResponse.json({ error: "Estado invalido" }, { status: 400 });
  }
  if (!(BRAZIL_STATES as readonly string[]).includes(crmUf)) {
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

  const consultPriceRaw = formData.get("consultPrice");
  const consultPrice =
    typeof consultPriceRaw === "string" && consultPriceRaw.trim() !== ""
      ? Number(consultPriceRaw)
      : null;

  const availableDays = formData.getAll("availableDays").map((v) => String(v));
  const availableShifts = formData.getAll("availableShifts").map((v) => String(v));
  const presentationRaw = formData.get("presentation");
  const presentation =
    typeof presentationRaw === "string" && presentationRaw.trim() !== "" ? presentationRaw.trim() : null;

  let photoPath: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) {
      return NextResponse.json({ error: "A foto deve ter no maximo 5MB" }, { status: 400 });
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
    crm,
    crm_uf: crmUf,
    specialty,
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
  });

  if (error) {
    console.error("Erro ao salvar candidatura:", error);
    return NextResponse.json({ error: "Falha ao enviar seu cadastro" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
