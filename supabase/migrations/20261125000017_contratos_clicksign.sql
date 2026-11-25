-- Contratos pela Clicksign (D45). Os contratos já enviados pela D4Sign continuam lá até assinar;
-- os NOVOS vão pela Clicksign (API v3: envelope → documento → signatário → requisitos → ativar → avisar).
alter table public.contracts
  add column if not exists provider_envelope_id text,
  add column if not exists provider_signer_id text;

-- Etapas da Clicksign (as da D4Sign continuam valendo para os contratos antigos)
alter table public.contracts drop constraint if exists contracts_step_check;
alter table public.contracts add constraint contracts_step_check check (step in (
  'gerar_pdf', 'enviar_documento', 'cadastrar_signatario', 'registrar_webhook', 'requisitos', 'ativar', 'enviar', 'concluido'));

-- Como o cliente se identificou na assinatura:
--   doc_selfie        D4Sign: documento + selfie com reconhecimento facial
--   facial_biometrics Clicksign: biometria facial (compara o rosto com o documento) — aprova sozinho
--   selfie_documento  Clicksign: selfie + foto do documento, sem comparação automática — a equipe confere
alter table public.contracts drop constraint if exists contracts_signer_auth_check;
alter table public.contracts add constraint contracts_signer_auth_check
  check (signer_auth in ('email', 'doc_selfie', 'facial_biometrics', 'selfie_documento'));

create index if not exists contracts_envelope_idx on public.contracts (provider_envelope_id) where provider_envelope_id is not null;
