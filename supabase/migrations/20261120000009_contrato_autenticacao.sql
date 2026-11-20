-- Registra COMO o signatário foi autenticado na D4Sign (D25 revisado):
-- só aprova a identidade sozinho se o contrato exigiu documento + selfie com reconhecimento facial.
alter table public.contracts
  add column if not exists signer_auth text check (signer_auth in ('email', 'doc_selfie'));
