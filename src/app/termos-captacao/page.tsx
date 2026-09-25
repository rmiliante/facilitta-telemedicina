export const metadata = {
  title: "Termo de Autorização de Contato · Facilitta Saúde",
};

export default function TermoCaptacaoPage() {
  return (
    <div className="min-h-screen bg-brand-bg pb-16">
      <div className="bg-brand-navy px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-facilitta.png"
            alt=""
            className="h-7 w-7 rounded-md"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <span className="text-base font-semibold leading-none text-white">
            facilitta<span className="text-brand-teal"> saúde</span>
          </span>
        </div>
      </div>
      <div className="mx-auto max-w-2xl px-4 pt-10">
        <a
          href="/captacao-medicos"
          className="mb-6 inline-flex items-center gap-1 text-xs font-semibold text-brand-teal-dark hover:underline"
        >
          ← Voltar ao cadastro
        </a>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-brand-teal-dark">
          Facilitta Saúde · Rede credenciada
        </p>
        <h1 className="text-2xl font-semibold text-zinc-900">
          Termo de Autorização de Contato
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-zinc-600">
          Documento simples que explica como e por que entramos em contato com você após o
          cadastro.
        </p>
        <div className="mt-8 space-y-5 rounded-2xl border border-zinc-200 bg-white p-8 text-sm leading-relaxed text-zinc-700 shadow-sm">
          <p>
            Ao preencher e enviar o formulário de cadastro de médicos da Facilitta Saúde, eu
            autorizo a Facilitta Saúde a entrar em contato comigo por telefone, WhatsApp e/ou
            e-mail, para tratar do meu possível credenciamento à rede de médicos parceiros da
            plataforma.
          </p>

          <div>
            <h2 className="mb-2 font-semibold text-brand-navy">Declaro que:</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Os dados que informei no formulário são verdadeiros e de minha responsabilidade;</li>
              <li>
                Esses dados serão usados exclusivamente para avaliar meu cadastro e para a
                Facilitta Saúde entrar em contato comigo sobre esse processo;
              </li>
              <li>
                Posso pedir a atualização ou exclusão dos meus dados a qualquer momento, enviando
                um e-mail para contato@facilittasaude.com.br;
              </li>
              <li>
                A Facilitta Saúde trata meus dados conforme a Lei Geral de Proteção de Dados
                (LGPD – Lei nº 13.709/2018).
              </li>
            </ul>
          </div>

          <p>
            Ao marcar a caixa de aceite no formulário de cadastro, confirmo que li e concordo
            com este termo.
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-zinc-400">
          Facilitta Saúde · www.facilittasaude.com.br
        </p>
      </div>
    </div>
  );
}
