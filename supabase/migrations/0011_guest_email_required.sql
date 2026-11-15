-- =====================================================================
-- 0011: guests must give a valid email at checkout (a second way to contact them).
-- The website form already checks this; this makes the database refuse it too.
-- Signed-in customers are unaffected: their order uses the email of their account.
-- Run AFTER 0001-0010. Safe to run twice.
-- =====================================================================
create or replace function place_guest_order(
  p_items jsonb, p_email text,
  p_name text, p_phone text, p_line1 text, p_barangay text,
  p_city text, p_province text, p_postal text, p_notes text,
  p_payment_method payment_method
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order uuid;
  v_token uuid;
begin
  if p_email is null or char_length(btrim(p_email)) > 120
     or btrim(p_email) !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'INVALID_INPUT:Please enter a valid email address';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'EMPTY_CART:Your cart is empty';
  end if;

  drop table if exists _order_lines;
  create temp table _order_lines (product_id uuid primary key, quantity int not null) on commit drop;
  begin
    insert into _order_lines (product_id, quantity)
    select (e->>'product_id')::uuid, least(sum((e->>'quantity')::int), 99)
      from jsonb_array_elements(p_items) e
     group by 1;
    if exists (select 1 from _order_lines where quantity < 1) then raise exception 'bad'; end if;
  exception when others then
    raise exception 'INVALID_INPUT:Your cart contains an invalid item';
  end;

  v_order := _create_order_from_lines(null, btrim(p_email), p_name, p_phone, p_line1, p_barangay,
                                      p_city, p_province, p_postal, p_notes, p_payment_method);
  select access_token into v_token from orders where id = v_order;
  return jsonb_build_object('id', v_order, 'token', v_token);
end $$;

revoke all on function place_guest_order(jsonb,text,text,text,text,text,text,text,text,text,payment_method) from public;
grant execute on function place_guest_order(jsonb,text,text,text,text,text,text,text,text,text,payment_method) to anon, authenticated;
