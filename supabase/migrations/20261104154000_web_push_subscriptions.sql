-- 1. Utworzenie tabeli subskrypcji powiadomień Push
create table public.pet_push_subscription (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    household_id uuid references public.gospodarstwo(id) on delete cascade,
    endpoint text not null,
    p256dh text not null,
    auth text not null,
    user_agent text,
    created_at timestamptz not null default now(),
    last_used_at timestamptz not null default now(),
    constraint pet_push_sub_user_endpoint_uniq unique (user_id, endpoint)
);

-- Indeksy dla wydajności wyszukiwania
create index if not exists idx_push_user on public.pet_push_subscription(user_id);
create index if not exists idx_push_household on public.pet_push_subscription(household_id);
create index if not exists idx_push_endpoint on public.pet_push_subscription(endpoint);

-- 2. Jawne nadanie uprawnień dla API (OBOWIĄZKOWO DLA KAŻDEJ NOWEJ TABELI)
grant select on public.pet_push_subscription to anon;
grant select, insert, update, delete on public.pet_push_subscription to authenticated;
grant select, insert, update, delete on public.pet_push_subscription to service_role;

-- 3. Włączenie RLS (Row Level Security)
alter table public.pet_push_subscription enable row level security;

-- 4. Definicja polityk RLS (zgodnie ze wzorcem InitPlan scalar subquery)
create policy push_subscription_select on public.pet_push_subscription
    for select to authenticated
    using (user_id = (select auth.uid()));

create policy push_subscription_insert on public.pet_push_subscription
    for insert to authenticated
    with check (user_id = (select auth.uid()));

create policy push_subscription_update on public.pet_push_subscription
    for update to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

create policy push_subscription_delete on public.pet_push_subscription
    for delete to authenticated
    using (user_id = (select auth.uid()));
