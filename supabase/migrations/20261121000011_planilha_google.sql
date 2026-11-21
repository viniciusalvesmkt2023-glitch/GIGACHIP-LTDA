-- =============================================================================
-- Planilha do gestor no Google Planilhas (D30). A planilha continua sendo a oficial:
-- o sistema lê os números que o gestor coloca e escreve a venda/bloqueio na linha do número.
-- Escritas pendentes ficam marcadas na linha e a rotina tenta de novo se o Google falhar.
-- =============================================================================
alter table public.lines
  add column if not exists sheet_pending   boolean not null default false, -- precisa escrever na planilha
  add column if not exists sheet_error     text,                           -- último erro ao escrever
  add column if not exists sheet_synced_at timestamptz;                    -- última escrita com sucesso

create index if not exists lines_sheet_pending_idx on public.lines (updated_at) where sheet_pending;
