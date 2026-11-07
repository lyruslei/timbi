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
