"use client";

import { useEffect } from "react";

/** Avisa o sistema, a cada minuto, que o médico está com a tela aberta. */
export default function DoctorHeartbeat() {
  useEffect(() => {
    const ping = () => {
      if (document.visibilityState === "visible") {
        fetch("/api/doctor/ping", { method: "POST", keepalive: true }).catch(() => {});
      }
    };
    ping();
    const timer = setInterval(ping, 60_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);
  return null;
}
