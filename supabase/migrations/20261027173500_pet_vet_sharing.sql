-- 1. Utworzenie tabeli linków / kodów QR do udostępniania kartoteki weterynarzowi (read-only)
create table public.pet_share_link (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.zwierze(id) on delete cascade,
  household_id uuid not null references public.gospodarstwo(id) on delete cascade,
  token text not null unique check (char_length(token) between 24 and 80),
  label text not null default '' check (char_length(label) <= 120),
  ttl_hours integer not null default 24 check (ttl_hours in (1, 24, 168)),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  open_count integer not null default 0 check (open_count >= 0),
  last_opened_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index pet_share_link_pet_idx
  on public.pet_share_link (pet_id, created_at desc);

create index pet_share_link_token_idx
  on public.pet_share_link (token);

-- Jawne nadanie uprawnień dla API (OBOWIĄZKOWO DLA KAŻDEJ NOWEJ TABELI zgodnie z AGENTS.md)
grant select on public.pet_share_link to anon;

grant select, insert, update, delete on public.pet_share_link to authenticated;

grant select, insert, update, delete on public.pet_share_link to service_role;

-- Włączenie RLS (Row Level Security)
alter table public.pet_share_link enable row level security;

-- Definicja polityk RLS (tylko zalogowani domownicy mogą przeglądać i zarządzać swoimi linkami;
-- odczyt publiczny dla weterynarza odbywa się wyłącznie po pojedynczym tokenie przez Edge Function)
create policy pet_share_link_read on public.pet_share_link
  for select to authenticated
  using (household_id in (select id from public.gospodarstwo));

create policy pet_share_link_insert on public.pet_share_link
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and household_id in (select id from public.gospodarstwo)
  );

create policy pet_share_link_update on public.pet_share_link
  for update to authenticated
  using (household_id in (select id from public.gospodarstwo))
  with check (household_id in (select id from public.gospodarstwo));

create policy pet_share_link_delete on public.pet_share_link
  for delete to authenticated
  using (household_id in (select id from public.gospodarstwo));

-- 2. Tabela logów otwarć udostępnionej kartoteki (historia otwarć dla właściciela)
create table public.pet_share_open_log (
  id uuid primary key default gen_random_uuid(),
  share_link_id uuid not null references public.pet_share_link(id) on delete cascade,
  pet_id uuid not null references public.zwierze(id) on delete cascade,
  household_id uuid not null references public.gospodarstwo(id) on delete cascade,
  opened_at timestamptz not null default now(),
  user_agent text not null default '' check (char_length(user_agent) <= 240)
);

create index pet_share_open_log_link_idx
  on public.pet_share_open_log (share_link_id, opened_at desc);

create index pet_share_open_log_pet_idx
  on public.pet_share_open_log (pet_id, opened_at desc);

-- Jawne nadanie uprawnień dla API (OBOWIĄZKOWO DLA KAŻDEJ NOWEJ TABELI zgodnie z AGENTS.md)
grant select on public.pet_share_open_log to anon;

grant select, insert, update, delete on public.pet_share_open_log to authenticated;

grant select, insert, update, delete on public.pet_share_open_log to service_role;

-- Włączenie RLS (Row Level Security)
alter table public.pet_share_open_log enable row level security;

-- Definicja polityk RLS
create policy pet_share_open_log_read on public.pet_share_open_log
  for select to authenticated
  using (household_id in (select id from public.gospodarstwo));
