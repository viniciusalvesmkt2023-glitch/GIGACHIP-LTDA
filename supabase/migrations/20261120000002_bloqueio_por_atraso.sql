-- D10 revisado: atraso BLOQUEIA a linha (não cancela). Bloquear e desbloquear são feitos à mão
-- na Vivo; os estados "pendente" viram filas no painel.
alter type public.line_status add value if not exists 'suspensao_pendente' before 'suspensa';
alter type public.line_status add value if not exists 'reativacao_pendente' after 'suspensa';

alter table public.lines
  add column if not exists suspension_requested_at timestamptz,
  add column if not exists reactivation_requested_at timestamptz,
  add column if not exists reactivated_at timestamptz;

comment on type public.line_status is
  'ativa → suspensao_pendente (atraso) → suspensa (equipe bloqueou na Vivo) → reativacao_pendente (pagou) → ativa (equipe desbloqueou). Cancelamento: cancelamento_pendente → cancelada.';
