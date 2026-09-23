"use client";

import { useEffect, useRef } from "react";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";

interface VideoRoomProps {
  roomUrl: string;
  token: string;
  onLeave?: () => void;
}

/**
 * Embute a videochamada do Daily.co dentro da página, ocupando todo o
 * espaço do contêiner pai. Usado tanto pelo médico quanto pelo
 * paciente — a diferença de permissão vem do `token` (meeting token),
 * gerado no servidor com is_owner true/false.
 */
export default function VideoRoom({ roomUrl, token, onLeave }: VideoRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callFrameRef = useRef<DailyCall | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const callFrame = DailyIframe.createFrame(containerRef.current, {
      showLeaveButton: true,
      iframeStyle: {
        width: "100%",
        height: "100%",
        border: "0",
      },
    });
    callFrameRef.current = callFrame;

    callFrame.on("left-meeting", () => onLeave?.());

    callFrame.join({ url: roomUrl, token }).catch((err) => {
      console.error("Erro ao entrar na sala de vídeo:", err);
    });

    return () => {
      callFrame.destroy();
      callFrameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomUrl, token]);

  return <div ref={containerRef} className="h-full w-full" />;
}
