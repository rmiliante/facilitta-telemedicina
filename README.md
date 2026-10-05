# Telemedicina — Facilitta Saúde

Plataforma de teleconsultas contratada por uma prefeitura: limite mensal
de consultas por especialidade, atendimento por ordem de chegada numa
cabine presencial, médicos com login próprio, receita digital assinada
e prestação de contas (financeiro e relatórios).

Projeto **separado** do CRM de WhatsApp — outro banco de dados, outro
deploy na Vercel, mesma identidade visual da Facilitta.

## O que já está pronto

**Atendimento**
- Fila do dia por ordem de chegada: a atendente põe o paciente na fila
  do médico (rotina ou retorno) e o médico chama o próximo
- Cabine de atendimento presencial (`/atendimento`): tela fixa, sem
  login, que abre a videochamada (Daily.co) do paciente chamado — com o
  botão "Não sou eu" caso a pessoa errada tenha sido chamada
- Link único do paciente (`/paciente/[token]`), sem senha, para
  atendimento remoto
- Sinais vitais (SpO2, BPM, PA, peso, HGT) com histórico de aferições
- Sala de consulta do médico: vídeo, ficha e linha do tempo do paciente,
  documentos anexados (exames, resultados), anotações e resumo da
  consulta (queixa principal e conduta)

**Receitas e documentos**
- Receita, pedido de exame e atestado gerados na própria consulta, com
  assinatura digital ICP-Brasil via Prescreve (certificado VIDaaS/BirdID
  do médico — uma autorização no celular vale 8h). O PDF assinado vai
  para o cadastro do paciente e entra na fila de impressão da atendente
- Receita controlada, modelos de receita do médico e busca de
  medicamentos e exames
- Módulo de prescrição Memed embutido (em homologação até a Facilitta
  ser aprovada como parceira — veja o passo 4)
- Controle de créditos de assinatura no `/admin`

**Equipe e médicos**
- Login da equipe (`/equipe/login`) com níveis de acesso — regras em
  [`src/lib/permissions.ts`](./src/lib/permissions.ts):

  | Nível | O que vê |
  |---|---|
  | Master | Tudo, inclusive equipe, auditoria e valores |
  | Gestor | Agenda, pacientes, histórico, relatórios e financeiro (só leitura) |
  | Financeiro | Financeiro (repasse, fechamento, NF), histórico e relatórios com valores — sem dados clínicos |
  | Prefeitura | Dashboard e relatórios com faturamento — sem pacientes e sem o que pagamos aos médicos |
  | Atendente | Painel de atendimento (`/atendente`): agenda, pacientes e fila |

- Captação de médicos: formulário público (`/captacao-medicos`) e fila
  de avaliação no `/admin`
- Área do médico: fila do dia, atendimentos, histórico, financeiro
  (extrato e NF), cadastro (RQE e endereço profissional) e ativação da
  assinatura digital

**Gestão**
- Limite mensal de consultas por especialidade
- Financeiro: valor pago ao médico por consulta e valor recebido da
  prefeitura por consulta (ambos congelados quando a consulta é
  concluída), fechamento mensal do repasse com NF e comprovante
- Relatórios e histórico de atendimentos para a prestação de contas
- Auditoria (LGPD): quem viu ou alterou o quê, inclusive logins, com
  bloqueio por excesso de tentativas

## 1. Pré-requisitos

- Conta na [Vercel](https://vercel.com)
- Conta no [Supabase](https://supabase.com) — **crie um projeto novo**,
  não reaproveite o do CRM de WhatsApp
- Conta no [Daily.co](https://dashboard.daily.co) (o plano grátis cobre
  bem o volume previsto)
- Conta de parceiro White Label na [Prescreve](https://prescreve.com)
  (assinatura digital das receitas)

## 2. Configurar o Supabase

1. Crie um novo projeto no Supabase.
2. Em **SQL Editor**, rode [`supabase/schema.sql`](./supabase/schema.sql).
   Ele cria as tabelas básicas e insere duas especialidades de exemplo
   ("Clínico Geral" e "Psicologia" — ajuste depois no `/admin`).
3. Rode as migrações abaixo, **nesta ordem**. Todas podem ser rodadas
   de novo sem estragar nada (é seguro rodar todas num banco que já tem
   parte delas):

   | # | Arquivo | O que faz |
   |---|---|---|
   | 1 | `migration_fila_e_equipe.sql` | Fila por ordem de chegada e contas da equipe |
   | 2 | `migration_cabine.sql` | Cabine de atendimento presencial |
   | 3 | `migration_nao_sou_eu.sql` | Botão "Não sou eu" da cabine |
   | 4 | `migration_conclusao_atendimento.sql` | Horário de término (tempo de consulta) |
   | 5 | `migration_sinais_vitais.sql` | Sinais vitais por consulta |
   | 6 | `migration_documentos_paciente.sql` | Documentos do paciente (bucket `exames`) |
   | 7 | `migration_receita_memed.sql` | Link de receita colado manualmente |
   | 8 | `migration_memed_email.sql` | E-mail do médico na Memed |
   | 9 | `migration_memed_prescritor.sql` | Médico como prescritor na Memed |
   | 10 | `migration_captacao_medicos.sql` | Captação de médicos (bucket `candidaturas`) |
   | 11 | `migration_receita_prescreve.sql` | Receita própria assinada pela Prescreve |
   | 12 | `migration_rqe.sql` | RQE e endereço profissional na receita |
   | 13 | `migration_afericoes.sql` | Histórico de aferições de sinais vitais |
   | 14 | `migration_tipo_consulta.sql` | Tipo da consulta (rotina ou retorno) |
   | 15 | `migration_rls.sql` | Bloqueia o acesso às tabelas pela chave pública |
   | 16 | `migration_valor_consulta.sql` | Valor pago ao médico por consulta |
   | 17 | `migration_financeiro.sql` | Fechamento mensal do repasse (bucket `financeiro`) |
   | 18 | `migration_auditoria_relatorios.sql` | Auditoria, limite de tentativas de login, modelos de receita e resumo da consulta |
   | 19 | `migration_valor_contrato_medico.sql` | Valor recebido da prefeitura por consulta |
   | 20 | `migration_niveis_acesso.sql` | Níveis de acesso (o antigo "admin" vira "master") |

   Os arquivos ficam na pasta [`supabase/`](./supabase/).
4. Em **Project Settings > API**, copie:
   - `Project URL` → `SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_URL`
   - chave `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (só no servidor)
   - chave `anon`/publishable → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (usada
     no navegador só para enviar arquivos grandes por URL assinada)

## 3. Configurar o Daily.co (videochamada)

1. Crie uma conta em [dashboard.daily.co](https://dashboard.daily.co).
2. Em **Developers**, copie:
   - A **API Key** → `DAILY_API_KEY`
   - O nome do seu domínio Daily (aparece nas URLs das salas, tipo
     `seu-dominio.daily.co`) → `DAILY_DOMAIN` (só a parte antes do
     `.daily.co`)

## 4. Receita digital (Prescreve e Memed)

- **Prescreve** (assinatura das receitas geradas na consulta): copie a
  chave White Label do portal do parceiro para `PRESCREVE_WL_KEY`. Sem
  ela, a assinatura fica indisponível. Cada PDF assinado consome um
  crédito; o saldo aparece no `/admin`.
- **Memed** (módulo de prescrição embutido): sem variáveis, usa as
  chaves públicas de **homologação** — as receitas não valem legalmente,
  servem só para testar o fluxo. Quando a Facilitta for aprovada como
  parceira (memed.com.br/parceiro-software), preencha `MEMED_API_KEY`,
  `MEMED_SECRET_KEY`, `MEMED_API_URL` e `MEMED_SCRIPT_URL` de produção.

## 5. Variáveis de ambiente

Preencha o `.env.local` na raiz do projeto:

```
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Sessões
SESSION_SECRET=          # string aleatória longa, ex: openssl rand -base64 32

# Videochamada
DAILY_API_KEY=
DAILY_DOMAIN=

# Acesso de recuperação ao /admin (opcional)
ADMIN_USER=
ADMIN_PASSWORD=

# Cabine de atendimento
BOOTH_ACCESS_KEY=        # ex: openssl rand -hex 16

# Receita digital
PRESCREVE_WL_KEY=
PRESCREVE_API_URL=       # opcional (padrão: https://api.prescreve.com)
RECEITA_ENDERECO=        # opcional: endereço usado quando o médico não tem endereço profissional
MEMED_API_KEY=           # opcional (sem ela = homologação)
MEMED_SECRET_KEY=
MEMED_API_URL=
MEMED_SCRIPT_URL=
```

- `ADMIN_USER`/`ADMIN_PASSWORD` liberam o `/admin` por usuário e senha
  do navegador — use para criar a primeira conta Master na aba
  **Equipe** e, depois disso, prefira o login normal em
  `/equipe/login`. Sem essas variáveis, o acesso de recuperação fica
  desligado.
- Com `BOOTH_ACCESS_KEY`, a cabine só funciona no computador que abriu
  uma vez `/atendimento?chave=<BOOTH_ACCESS_KEY>` (a chave fica salva
  num cookie). Sem ela, qualquer pessoa consegue pegar o link da
  consulta em andamento.

Configure as mesmas variáveis na Vercel em **Project Settings >
Environment Variables** antes do deploy.

## 6. Rodar localmente

```bash
npm install
npm run dev
```

| Endereço | Quem usa |
|---|---|
| `/equipe/login` | Login da equipe (Master, Gestor, Financeiro, Prefeitura, Atendente) |
| `/admin` | Painel de gestão (conforme o nível de acesso) |
| `/atendente` | Painel da atendente: agenda, pacientes e fila |
| `/atendimento` | Tela fixa da cabine presencial |
| `/medico/login` | Login do médico (cadastre o médico antes pelo `/admin`) |
| `/medico` | Fila do dia do médico |
| `/paciente/[token]` | Entrada do paciente remoto (link gerado no agendamento) |
| `/captacao-medicos` | Formulário público para médicos se candidatarem |

## 7. Deploy na Vercel

```bash
npm install -g vercel
vercel --prod
```

Ou conecte o repositório Git pelo painel da Vercel. Configure as
variáveis de ambiente do passo 5 lá também.

## 8. Estrutura do projeto

```
src/
  app/
    admin/                → painel de gestão (abas por nível de acesso)
    atendente/            → painel da atendente
    atendimento/          → cabine presencial
    equipe/login/         → login da equipe
    medico/               → área do médico (fila, consulta, atendimentos,
                            histórico, financeiro, cadastro, assinatura)
    paciente/[token]/     → entrada do paciente (sem login)
    captacao-medicos/     → formulário público de captação
    api/
      admin/**            → rotas da equipe (bloqueadas por nível no proxy)
      doctor/**           → rotas do médico
      appointments/[token]/** → rotas públicas do paciente
      booth/              → cabine
      auth/               → login/logout (médico e equipe)
      public/             → formulário de captação
  components/             → telas (AdminPanel, StaffPanel, ConsultationClient,
                            PrescriptionPanel, FinanceTab, ReportsTab, ...)
  lib/
    permissions.ts        → níveis de acesso da equipe
    auth.ts               → sessões (cookie JWT)
    supabase.ts           → cliente do banco (servidor, service role)
    supabaseBrowser.ts    → cliente do navegador (só uploads assinados)
    daily.ts              → videochamada
    prescreve.ts          → assinatura digital das receitas
    prescriptionPdf.ts    → geração do PDF da receita
    memed.ts              → módulo de prescrição Memed
    finance.ts, reports.ts, audit.ts, ...
  proxy.ts                → protege /admin, /atendente, /medico e a cabine
supabase/
  schema.sql              → schema inicial
  migration_*.sql         → migrações (ordem no passo 2)
```

## 9. Sobre o limite mensal de consultas

O limite é configurável por especialidade (`monthly_quota` na tabela
`specialties`, editável em **Especialidades** no `/admin`). Ao agendar,
o sistema conta quantas consultas daquela especialidade já existem no
mesmo mês e bloqueia o agendamento se o limite já tiver sido atingido.

## 10. Próximos passos sugeridos

- Memed em produção (cadastro da Facilitta como parceira de software)
- Envio dos documentos assinados ao paciente por e-mail e, depois,
  por WhatsApp (hoje eles vão só para a fila de impressão)
- Lembrete automático para o paciente antes da consulta
- Tela de reagendamento e histórico de faltas
