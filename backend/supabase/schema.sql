-- Bitelog schema. Only the backend (service-role key) touches these tables;
-- RLS is on with no policies, so the public anon key can read nothing.

create table goals (
  id int primary key default 1 check (id = 1),
  kcal real not null default 2200,
  protein real not null default 150,
  carbs real not null default 220,
  fat real not null default 70
);
insert into goals (id) values (1);

create table entries (
  id bigint generated always as identity primary key,
  day date not null,
  food text not null,
  qty real not null,
  kcal real not null,
  protein real not null,
  carbs real not null,
  fat real not null,
  created_at timestamptz not null default now()
);
create index entries_day on entries(day);

create table messages (
  id bigint generated always as identity primary key,
  day date not null,
  role text not null check (role in ('user', 'bot')),
  text text not null,
  created_at timestamptz not null default now()
);
create index messages_day on messages(day);

alter table goals enable row level security;
alter table entries enable row level security;
alter table messages enable row level security;

-- Saves one chat turn atomically: the new entries, an optional goals change and
-- the two chat messages all commit together, or none of them do.
create or replace function log_turn(p_day date, p_items jsonb, p_goals jsonb, p_messages jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into entries (day, food, qty, kcal, protein, carbs, fat)
  select p_day, i->>'food', (i->>'qty')::real, (i->>'kcal')::real,
         (i->>'protein')::real, (i->>'carbs')::real, (i->>'fat')::real
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as i;

  if p_goals is not null and p_goals <> 'null'::jsonb then
    update goals set kcal = (p_goals->>'kcal')::real, protein = (p_goals->>'protein')::real,
                     carbs = (p_goals->>'carbs')::real, fat = (p_goals->>'fat')::real
    where id = 1;
  end if;

  insert into messages (day, role, text)
  select p_day, m->>'role', m->>'text'
  from jsonb_array_elements(p_messages) with ordinality as t(m, n)
  order by n;
end;
$$;

-- Only the backend's service role may call it.
revoke execute on function log_turn(date, jsonb, jsonb, jsonb) from public, anon, authenticated;
