"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import LogoutButton from "./LogoutButton";

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" strokeLinecap="round" />
    </svg>
  );
}

function IconList() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
      <path d="M4 6h11M4 12h11M4 18h7" strokeLinecap="round" />
      <circle cx="19" cy="12" r="2.2" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/medico", label: "Fila de hoje", icon: <IconCalendar /> },
  { href: "/medico/atendimentos", label: "Atendimentos", icon: <IconList /> },
];

/**
 * Envolve a área do médico com o mesmo padrão visual do CRM de WhatsApp:
 * sidebar fixa com logo e navegação, que vira menu off-canvas no celular.
 * Usado só nas telas de navegação (agenda) — a tela de consulta em si
 * fica em tela cheia, sem essa barra lateral.
 */
export default function DoctorShell({
  doctorName,
  children,
}: {
  doctorName: string;
  children: React.ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const pathname = usePathname();
  const activeLabel = NAV_ITEMS.find((item) => item.href === pathname)?.label ?? "Área do médico";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-brand-bg">
      <nav
        className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 -translate-x-full flex-col border-r border-zinc-200 bg-white transition-transform duration-200 md:static md:z-auto md:w-56 md:translate-x-0 ${
          navOpen ? "translate-x-0" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-4 py-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-facilitta.png" alt="Facilitta Saúde" className="h-7 w-7 rounded-md" />
            <span className="text-sm font-semibold leading-none text-brand-navy">
              facilitta<span className="text-brand-teal-dark"> saúde</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setNavOpen(false)}
            aria-label="Fechar menu"
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 md:hidden"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-4">
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Área do médico
          </p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setNavOpen(false)}
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "bg-brand-teal/15 text-brand-teal-dark"
                      : "text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-zinc-100 px-4 py-3">
          <p className="mb-2 truncate text-xs font-medium text-zinc-500">{doctorName}</p>
          <LogoutButton />
        </div>
      </nav>

      {navOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-3 border-b border-brand-navy bg-brand-navy px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label="Abrir menu"
            className="rounded-md p-1 text-white hover:bg-white/10 md:hidden"
          >
            <IconMenu />
          </button>
          <h1 className="text-sm font-semibold text-white">{activeLabel}</h1>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-3xl">{children}</div>
        </div>
      </div>
    </div>
  );
}
