# Telemedicina — Facilitta Saúde

Plataforma de teleconsultas contratada por uma prefeitura: até 50
consultas/mês por especialidade, médicos com login próprio, pacientes
acessando por um link único (sem senha), videochamada e histórico do
paciente.

Projeto **separado** do CRM de WhatsApp — outro banco de dados, outro
deploy na Vercel, mesma identidade visual da Facilitta.

## O que já está pronto (MVP)

- Login de médico (e-mail/senha) com sessão própria
- Painel administrativo (`/admin`, protegido por usuário/senha) para
  cadastrar especialidades, médicos, pacientes e agendar consultas —
  respeitando o limite mensal configurado por especialidade
- Agenda do médico (`/medico`) — vê só as consultas atribuídas a ele
- Sala de videochamada (Daily.co) — o médico inicia pela agenda, o
  paciente entra pelo link único gerado na hora do agendamento
- Painel lateral na consulta com os dados do paciente e o histórico de
  consultas anteriores, com campo de anotações que salva automaticamente

## O que fica para a próxima etapa

- Emissão de receitas/atestados com assinatura digital (integração
  com o Memed)
- Envio automático de documentos por e-mail (e depois WhatsApp)

## 1. Pré-requisitos

- Conta na [Vercel](https://vercel.com)
- Conta no [Supabase](https://supabase.com) — **crie um projeto novo**,
  não reaproveite o do CRM de WhatsApp
- Conta no [Daily.co](https://dashboard.daily.co) (plano grátis cobre
  bem o volume de 50 consultas/mês — veja a conta feita com o Rodrigo)

## 2. Configurar o Supabase

1. Crie um novo projeto no Supabase.
2. Em **SQL Editor**, rode o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql).
   Isso cria as tabelas `specialties`, `doctors`, `patients` e
   `appointments`, e já insere duas especialidades de exemplo
   ("Clínico Geral" e "Psicologia" — renomeie/ajuste como precisar,
   direto no painel `/admin` depois).
3. Em **Project Settings > API**, copie:
   - `Project URL` → variável `SUPABASE_URL`
   - `service_role` key (não a `anon`!) → variável `SUPABASE_SERVICE_ROLE_KEY`

## 3. Configurar o Daily.co (videochamada)

1. Crie uma conta em [dashboard.daily.co](https://dashboard.daily.co).
2. Em **Developers**, copie:
   - A **API Key** → variável `DAILY_API_KEY`
   - O nome do seu domínio Daily (aparece nas URLs das salas, tipo
     `seu-dominio.daily.co`) → variável `DAILY_DOMAIN` (só a parte
     antes do `.daily.co`)

O plano grátis inclui 10.000 minutos-participante por mês — bem acima
do necessário pras 50 consultas/mês previstas.

## 4. Variáveis de ambiente

Preencha o `.env.local` (já criado na raiz do projeto):

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SESSION_SECRET=          # string aleatória longa, ex: openssl rand -base64 32
DAILY_API_KEY=
DAILY_DOMAIN=
ADMIN_USER=facilitta
ADMIN_PASSWORD=          # invente uma senha forte pra área /admin
```

Configure as mesmas variáveis na Vercel em **Project Settings >
Environment Variables** antes do deploy.

## 5. Rodar localmente

```bash
npm install
npm run dev
```

- `http://localhost:3000/admin` — painel da equipe (pede a senha de
  `ADMIN_USER`/`ADMIN_PASSWORD`)
- `http://localhost:3000/medico/login` — login do médico (cadastre um
  médico primeiro pelo `/admin`)
- O link do paciente é gerado automaticamente ao agendar uma consulta
  pelo `/admin` (botão "Copiar link do paciente")

## 6. Deploy na Vercel

```bash
npm install -g vercel
vercel --prod
```

Ou conecte o repositório Git pelo painel da Vercel. Configure as
variáveis de ambiente do passo 4 lá também.

## 7. Estrutura do projeto

```
src/
  app/
    page.tsx                              → landing simples (link pro login do médico)
    admin/page.tsx                        → painel da equipe (especialidades, médicos, pacientes, agenda)
    medico/login/page.tsx                 → login do médico
    medico/page.tsx                       → agenda do médico logado
    medico/consulta/[id]/page.tsx         → sala de consulta (vídeo + dados do paciente + anotações)
    paciente/[token]/page.tsx             → tela de entrada do paciente (sem login)
    api/
      auth/login, auth/logout             → sessão do médico
      doctor/appointments/[id]            → detalhes/anotações da consulta (médico)
      doctor/appointments/[id]/room       → cria/entra na sala de vídeo (médico)
      appointments/[token]                → info pública da consulta (paciente)
      appointments/[token]/room           → entra na sala de vídeo (paciente)
      admin/**                            → CRUD de especialidades/médicos/pacientes/agenda
  components/
    AdminPanel.tsx                        → UI do painel administrativo
    ConsultationClient.tsx                → UI da sala de consulta (lado do médico)
    VideoRoom.tsx                         → embed da videochamada (Daily.co)
    LogoutButton.tsx
  lib/
    supabase.ts                           → cliente do banco (server-side)
    auth.ts                               → sessão do médico (cookie JWT)
    daily.ts                              → integração com a API do Daily.co
    appointments.ts                       → consultas compartilhadas entre rotas/páginas
  proxy.ts                                → protege /admin (Basic Auth) e /medico (sessão)
supabase/
  schema.sql                              → schema do banco (rodar uma vez no Supabase)
```

## 8. Sobre o limite de 50 consultas/mês

O limite é configurável por especialidade (`monthly_quota` na tabela
`specialties`, editável em **Especialidades** no `/admin`). Ao agendar
uma consulta pelo `/admin`, o sistema conta quantas consultas daquela
especialidade já existem no mesmo mês/ano e bloqueia o agendamento se
o limite já tiver sido atingido.

## 9. Próximos passos sugeridos

- Integração com o Memed pra emissão de receitas/atestados com
  validade jurídica (assinatura digital)
- Envio automático desses documentos por e-mail (SMTP da Facilitta) e,
  depois, por WhatsApp
- Notificação/lembrete automático pro paciente antes do horário da
  consulta (e-mail ou WhatsApp)
- Tela de reagendamento e histórico de faltas
- Relatório mensal de consultas realizadas por especialidade (para a
  prestação de contas com a prefeitura)
