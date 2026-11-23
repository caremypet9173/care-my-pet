-- Increase notes length limit on wynik_badania to accommodate multi-page imaging/descriptive reports (CT, ultrasound, X-ray, MRI, histopathology).
alter table public.wynik_badania
  drop constraint if exists wynik_badania_notes_check;

alter table public.wynik_badania
  add constraint wynik_badania_notes_check
  check (char_length(notes) <= 12000);
