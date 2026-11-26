-- Śledzenie wysłania wiadomości powitalnej do uczestników zamkniętego pilotażu
alter table public.pilot_whitelist
  add column if not exists welcome_sent_at timestamptz;

comment on column public.pilot_whitelist.welcome_sent_at is
  'Znacznik czasu wysłania e-maila powitalnego z instrukcją rejestracji w pilotażu.';
