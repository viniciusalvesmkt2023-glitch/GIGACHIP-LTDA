-- Chip físico: o cliente envia só a foto do verso da embalagem e o número do chip (ICCID);
-- o IMEI (print do *#06#) passa a ser pedido só no eSIM (D38).
alter table public.device_info alter column imei_encrypted drop not null;
alter table public.device_info alter column imei_last4 drop not null;

-- Que imagem o cliente mandou: print do registro do eSIM (*#06#) ou foto da embalagem do chip
alter table public.device_info add column if not exists image_kind text
  check (image_kind in ('print_esim', 'foto_embalagem'));

-- Sempre tem que existir ao menos um identificador: IMEI (eSIM) ou ICCID (chip físico)
alter table public.device_info drop constraint if exists device_info_tem_identificador;
alter table public.device_info add constraint device_info_tem_identificador
  check (imei_encrypted is not null or iccid_encrypted is not null);
