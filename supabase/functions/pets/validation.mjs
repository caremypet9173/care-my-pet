// Shared pure validation, executable in Deno and Node's test runner.
export function validatePet(input, today = new Date().toISOString().slice(0, 10)) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, field: 'pet' };
  const text = (key, max, required = false) => {
    const v = input[key];
    if (v != null && typeof v !== 'string') throw key;
    const s = v?.trim() || null;
    if ((required && !s) || (s && s.length > max)) throw key;
    return s;
  };
  try {
    const imie = text('imie', 80, true);
    if (!['cat', 'dog'].includes(input.gatunek)) throw 'gatunek';
    if (!['female', 'male', 'unknown'].includes(input.plec)) throw 'plec';
    if (input.kastracja !== null && typeof input.kastracja !== 'boolean') throw 'kastracja';
    const data_urodzenia = text('data_urodzenia', 10);
    if (data_urodzenia && (!/^\d{4}-\d{2}-\d{2}$/.test(data_urodzenia)
      || Number.isNaN(Date.parse(data_urodzenia))
      || new Date(data_urodzenia).toISOString().slice(0, 10) !== data_urodzenia
      || data_urodzenia < '1900-01-01' || data_urodzenia > today)) throw 'data_urodzenia';
    if (!['chip', 'tattoo', 'none', 'unknown'].includes(input.identyfikacja)) throw 'identyfikacja';
    const numbered = ['chip', 'tattoo'].includes(input.identyfikacja);
    const numer_id = numbered ? text('numer_id', 50, true) : null;
    if (input.identyfikacja === 'chip' && !/^\d{15}$/.test(numer_id)) throw 'numer_id';
    const data_urodzenia_przyblizona = input.data_urodzenia_przyblizona ?? false;
    if (typeof data_urodzenia_przyblizona !== 'boolean' || (data_urodzenia_przyblizona && !data_urodzenia)) throw 'data_urodzenia';
    const avatar_path = text('avatar_path', 77);
    if (avatar_path && !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(avatar_path)) throw 'avatar_path';
    return { ok: true, value: { imie, gatunek: input.gatunek, rasa: text('rasa', 100), data_urodzenia,
      plec: input.plec, kastracja: input.kastracja, identyfikacja: input.identyfikacja,
      numer_id, notatki: text('notatki', 4000), data_urodzenia_przyblizona, avatar_path } };
  } catch (field) { return { ok: false, field }; }
}
