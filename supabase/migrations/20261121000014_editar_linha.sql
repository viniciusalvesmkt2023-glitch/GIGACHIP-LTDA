-- Editar linha no painel: a correção também é escrita na planilha do gestor (passando por cima do
-- que estiver lá, porque foi a equipe que corrigiu). Volta a false depois de escrever.
alter table public.lines add column if not exists sheet_overwrite boolean not null default false;
