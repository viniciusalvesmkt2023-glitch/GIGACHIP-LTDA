-- Planos iniciais (D8, D11): ligações ilimitadas; bônus de 100GB renova todo mês; sem fidelidade.
insert into public.plan_categories (name, slug, sort_order) values
  ('Planos Vivo', 'planos-vivo', 1);

insert into public.plans
  (category_id, slug, name, short_description, data_base_gb, data_bonus_gb, monthly_price_cents, sort_order, benefits)
select c.id, p.slug, p.name, p.short_description, p.base, p.bonus, p.price, p.sort_order, p.benefits::jsonb
from public.plan_categories c
cross join (values
  ('vivo-200gb', 'Plano 200GB', '100GB + 100GB de bônus', 100, 100, 12499, 1, '["200GB de internet por mês", "Bônus de 100GB renovado todo mês", "Ligações ilimitadas", "Sem fidelidade", "Rede Vivo"]'),
  ('vivo-300gb', 'Plano 300GB', '200GB + 100GB de bônus', 200, 100, 14999, 2, '["300GB de internet por mês", "Bônus de 100GB renovado todo mês", "Ligações ilimitadas", "Sem fidelidade", "Rede Vivo"]'),
  ('vivo-400gb', 'Plano 400GB', '300GB + 100GB de bônus', 300, 100, 17999, 3, '["400GB de internet por mês", "Bônus de 100GB renovado todo mês", "Ligações ilimitadas", "Sem fidelidade", "Rede Vivo"]')
) as p(slug, name, short_description, base, bonus, price, sort_order, benefits)
where c.slug = 'planos-vivo';
