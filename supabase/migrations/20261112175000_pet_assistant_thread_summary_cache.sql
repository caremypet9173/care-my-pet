-- Cache wygenerowanych wniosków PDF na poziomie wątku rozmowy z Asystentem AI
-- Zapobiega ponownemu wywołaniu API Gemini i zużywaniu tokenów, dopóki w wątku nie pojawią się nowe odpowiedzi.

alter table public.pet_assistant_thread
  add column if not exists summary_cache jsonb
    check (summary_cache is null or jsonb_typeof(summary_cache) = 'object'),
  add column if not exists summary_fingerprint text
    check (summary_fingerprint is null or char_length(summary_fingerprint) between 1 and 128);
