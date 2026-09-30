-- ================================================================
-- Migração: histórico de aferições de sinais vitais.
-- Cada aferição é uma linha própria (data/hora, quem registrou), ligada
-- ao paciente e, quando houver, à consulta. A atendente registra no
-- cadastro do paciente; o médico vê a atual e a anterior.
-- Copia os sinais vitais já salvos nas consultas (nada é apagado).
-- Rode este arquivo no SQL Editor do Supabase.
-- ================================================================

create table if not exists vital_signs (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  measured_at timestamptz not null default now(),
  spo2 text,
  bpm text,
  pa text,
  peso text,
  hgt text,
  recorded_by_name text,
  recorded_by_role text, -- atendente | admin | medico
  created_at timestamptz not null default now()
);

create index if not exists vital_signs_patient_idx on vital_signs (patient_id, measured_at desc);

-- Mesmo padrão das outras tabelas: RLS ligado e sem políticas, só o
-- servidor (service role) lê e grava.
alter table vital_signs enable row level security;

-- Copia os sinais vitais que já estavam nas consultas (roda uma vez só).
insert into vital_signs (patient_id, appointment_id, measured_at, spo2, bpm, pa, peso, hgt, recorded_by_name, recorded_by_role)
select a.patient_id, a.id, coalesce(a.called_at, a.scheduled_at),
       a.vital_spo2, a.vital_bpm, a.vital_pa, a.vital_peso, a.vital_hgt,
       d.name, 'medico'
from appointments a
left join doctors d on d.id = a.doctor_id
where coalesce(a.vital_spo2, a.vital_bpm, a.vital_pa, a.vital_peso, a.vital_hgt) is not null
  and not exists (select 1 from vital_signs v where v.appointment_id = a.id);

notify pgrst, 'reload schema';
