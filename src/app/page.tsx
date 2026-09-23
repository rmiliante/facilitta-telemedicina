import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-brand-bg px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-facilitta.png"
          alt="Facilitta Saúde"
          className="mx-auto mb-4 h-10 w-10 rounded-md"
        />
        <h1 className="mb-1 text-lg font-semibold text-brand-navy">
          facilitta<span className="text-brand-teal-dark"> saúde</span>
        </h1>
        <p className="mb-6 text-xs text-zinc-500">Plataforma de teleconsultas</p>

        <Link
          href="/medico/login"
          className="block w-full rounded-md bg-brand-navy px-4 py-2.5 text-sm font-medium text-white"
        >
          Sou médico
        </Link>

        <p className="mt-6 text-[11px] text-zinc-400">
          Pacientes acessam pelo link enviado por e-mail antes da consulta.
        </p>
      </div>
    </div>
  );
}
