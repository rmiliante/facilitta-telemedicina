// Cliente mínimo pra API REST do Daily.co (criação de salas de vídeo).
// Docs: https://docs.daily.co/reference/rest-api

const DAILY_API_BASE = "https://api.daily.co/v1";

function getApiKey() {
  const key = process.env.DAILY_API_KEY;
  if (!key) {
    throw new Error("Faltando DAILY_API_KEY nas variáveis de ambiente.");
  }
  return key;
}

/**
 * Garante que existe uma sala do Daily.co pra essa consulta, criando
 * se ainda não existir. O nome da sala é baseado no id da consulta,
 * então é idempotente — chamar de novo devolve a mesma sala.
 */
export async function ensureDailyRoom(appointmentId: string): Promise<string> {
  const roomName = `consulta-${appointmentId}`;
  const apiKey = getApiKey();

  // Tenta buscar a sala já existente primeiro.
  const getRes = await fetch(`${DAILY_API_BASE}/rooms/${roomName}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (getRes.ok) {
    return roomName;
  }

  // Não existe ainda — cria. Expira automaticamente 6h depois de criada,
  // tempo mais que suficiente pra consulta acontecer.
  const exp = Math.floor(Date.now() / 1000) + 6 * 60 * 60;
  const createRes = await fetch(`${DAILY_API_BASE}/rooms`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: roomName,
      properties: {
        exp,
        enable_chat: true,
        enable_screenshare: true,
        eject_at_room_exp: true,
      },
    }),
  });

  if (!createRes.ok) {
    const data = await createRes.json().catch(() => ({}));
    console.error("Erro ao criar sala no Daily.co:", data);
    throw new Error("Falha ao criar sala de videochamada");
  }

  return roomName;
}

export function dailyRoomUrl(roomName: string): string {
  const domain = process.env.DAILY_DOMAIN;
  if (!domain) {
    throw new Error("Faltando DAILY_DOMAIN nas variáveis de ambiente.");
  }
  return `https://${domain}.daily.co/${roomName}`;
}

/**
 * Cria um "meeting token" — dá o nome de exibição certo pra cada
 * participante dentro da sala (médico vê o nome do médico, paciente
 * vê o nome do paciente) sem precisar pedir pra digitar.
 */
export async function createMeetingToken(
  roomName: string,
  userName: string,
  isOwner: boolean
): Promise<string> {
  const apiKey = getApiKey();

  const res = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName,
        is_owner: isOwner,
      },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Erro ao criar meeting token:", data);
    throw new Error("Falha ao gerar acesso à sala de videochamada");
  }

  return data.token as string;
}
