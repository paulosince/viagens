-- Corrige o status dos itens do orçamento importado
-- Valores realizados só ficam preenchidos para compras já confirmadas.
do $$
declare target_user uuid; trip_id_var uuid;
begin
  select id into target_user from auth.users where lower(email)=lower('cintiapfs@gmail.com') limit 1;
  select id into trip_id_var from public.trips where user_id=target_user and name='Paris & Lisboa' limit 1;
  if trip_id_var is null then raise exception 'Viagem não encontrada para esta conta.'; end if;
  update public.budget_items set actual_amount=null, purchase_status='pending' where trip_id=trip_id_var;
  update public.budget_items set actual_amount=18190.94, purchase_status='purchased' where trip_id=trip_id_var and label='Passagens Internacionais (Brasil ↔ Lisboa) — British Airways';
  update public.budget_items set actual_amount=4671.44, purchase_status='purchased' where trip_id=trip_id_var and label='Aéreos Intra-Europa (Lisboa ↔ Paris-Beauvais) · Ryanair';
  update public.budget_items set actual_amount=12260, purchase_status='purchased' where trip_id=trip_id_var and label='Yooma Urban Lodge Paris — 2 Quartos · 8 Noites';
  update public.budget_items set actual_amount=942.64, purchase_status='purchased' where trip_id=trip_id_var and label='Hotel Jardim Lisboa — 1 Noite (19/11)';
  update public.budget_items set actual_amount=2710, purchase_status='purchased' where trip_id=trip_id_var and label='Your Lisbon Home Parque das Nações — 2 Noites (29–30/11)';
  update public.budget_items set actual_amount=3334.86, purchase_status='purchased' where trip_id=trip_id_var and label='Disneyland Paris — 5 pessoas · 1 dia · 2 parques · COMPRADO';
end $$;
