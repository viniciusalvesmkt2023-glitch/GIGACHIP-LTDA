-- Posição da linha na planilha do gestor (o "1, 2, 3" da lateral do Google Planilhas), para o
-- painel mostrar na mesma ordem e abrir a planilha direto na linha. Atualizada a cada leitura.
alter table public.lines
  add column if not exists sheet_tab text,  -- nome da aba
  add column if not exists sheet_gid int,   -- id da aba (para o link abrir na aba certa)
  add column if not exists sheet_row int;   -- número da linha na planilha
