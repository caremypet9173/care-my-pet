-- ==============================================================================
-- Migracja: pet_archive_links
-- Linki do archiwum danych pupila (ważne 7 dni, zabezpieczone kodem na e-mail)
-- z obsługą pobierania pełnego raportu PDF i oryginalnych załączników badań.
-- ==============================================================================

-- 1. Utworzenie tabeli public.pet_archive_link
create table public.pet_archive_link (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.zwierze(id) on delete cascade,
  household_id uuid not null references public.gospodarstwo(id) on delete cascade,
  token text not null unique check (char_length(token) between 24 and 80),
  recipient_email text not null check (char_length(recipient_email) between 3 and 254),
  label text not null default '' check (char_length(label) <= 120),
  access_code_hash text not null,
  access_code_salt text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz null,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz null,
  unlocked_count integer not null default 0 check (unlocked_count >= 0),
  pdf_download_count integer not null default 0 check (pdf_download_count >= 0),
  file_download_count integer not null default 0 check (file_download_count >= 0),
  last_accessed_at timestamptz null,
  email_sent_at timestamptz null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index pet_archive_link_pet_idx
  on public.pet_archive_link (pet_id, created_at desc);

create index pet_archive_link_household_idx
  on public.pet_archive_link (household_id);

-- 2. Jawne nadanie uprawnień dla API (OBOWIĄZKOWO DLA KAŻDEJ NOWEJ TABELI zgodnie z AGENTS.md)
grant select on public.pet_archive_link to anon;

grant select, insert, update, delete on public.pet_archive_link to authenticated;

grant select, insert, update, delete on public.pet_archive_link to service_role;

-- 3. Włączenie RLS (Row Level Security)
alter table public.pet_archive_link enable row level security;

-- 4. Polityki RLS — dostęp wyłącznie dla właściciela gospodarstwa
create policy pet_archive_link_owner_read on public.pet_archive_link
  for select to authenticated
  using (
    household_id in (
      select g.id from public.gospodarstwo g where g.owner_id = (select auth.uid())
    )
  );

create policy pet_archive_link_owner_update on public.pet_archive_link
  for update to authenticated
  using (
    household_id in (
      select g.id from public.gospodarstwo g where g.owner_id = (select auth.uid())
    )
  )
  with check (
    household_id in (
      select g.id from public.gospodarstwo g where g.owner_id = (select auth.uid())
    )
  );
