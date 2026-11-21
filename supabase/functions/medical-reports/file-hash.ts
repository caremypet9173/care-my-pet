import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3';

export async function fileHash(bytes: Uint8Array) {
  const hash = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export type DuplicateSummary = {
  id: string;
  title: string;
  test_date: string;
};

export type TrashedSamePetMatch = {
  id: string;
  title: string;
  test_date: string;
  deleted_at: string;
};

export type HouseholdHashMatch = {
  id: string;
  pet_id: string;
  pet_name: string;
  pet_archived: boolean;
  title: string;
  test_date: string;
  status: 'active' | 'trashed';
  deleted_at: string | null;
};

export type HashLookupResult =
  | { kind: 'none' }
  | { kind: 'duplicate'; duplicate: DuplicateSummary }
  | { kind: 'trashed_same_pet'; trashed_same_pet: TrashedSamePetMatch }
  | { kind: 'household_match'; household_match: HouseholdHashMatch };

export type RejectedHashRecord = {
  document_type: 'non_medical' | 'unreadable';
  reason: string;
};

// Read through the caller's RLS. Only active reports on the same pet count as hard duplicates.
export async function findDuplicate(
  client: SupabaseClient,
  petId: string,
  hash: string,
  exclude?: string,
): Promise<DuplicateSummary | null> {
  const { data: known, error } = await client
    .from('wynik_badania')
    .select('id,title,test_date')
    .eq('zwierze_id', petId)
    .eq('source_sha256', hash)
    .is('deleted_at', null)
    .order('confirmed_at')
    .limit(2);
  if (error) throw error;
  const match = known?.find((row) => row.id !== exclude);
  if (match) return match;

  for (;;) {
    const { data: legacy, error: legacyError } = await client
      .from('wynik_badania')
      .select('id,title,test_date,source_path')
      .eq('zwierze_id', petId)
      .is('source_sha256', null)
      .is('deleted_at', null)
      .order('id')
      .limit(100);
    if (legacyError) throw legacyError;
    for (const row of legacy ?? []) {
      const { data: file, error: dlError } = await client.storage
        .from('medical-documents')
        .download(row.source_path);
      if (dlError || !file) throw new Error('duplicate_check_failed');
      const digest = await fileHash(new Uint8Array(await file.arrayBuffer()));
      const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { persistSession: false } },
      );
      const { error: cacheError } = await admin
        .from('wynik_badania')
        .update({ source_sha256: digest })
        .eq('id', row.id)
        .eq('zwierze_id', petId)
        .is('source_sha256', null);
      if (cacheError) throw cacheError;
      if (digest === hash && row.id !== exclude) {
        return { id: row.id, title: row.title, test_date: row.test_date };
      }
    }
    if (!legacy || legacy.length < 100) return null;
  }
}

// Household-scoped SHA-256 lookup (strictly within the caller's household via RLS).
// Priority: active on same pet -> trashed on same pet -> active on other pet -> trashed on other pet.
export async function findHouseholdHashMatch(
  client: SupabaseClient,
  householdId: string,
  currentPetId: string,
  hash: string,
  exclude?: string,
): Promise<HashLookupResult> {
  // First preserve legacy backfill for the active pet if any legacy rows lack source_sha256.
  const activeDup = await findDuplicate(client, currentPetId, hash, exclude);
  if (activeDup) {
    return { kind: 'duplicate', duplicate: activeDup };
  }

  const { data: rows, error } = await client
    .from('wynik_badania')
    .select('id,zwierze_id,title,test_date,deleted_at,confirmed_at,pet:zwierze(id,imie,archived_at)')
    .eq('gospodarstwo_id', householdId)
    .eq('source_sha256', hash)
    .order('confirmed_at', { ascending: false })
    .limit(20);

  if (error) throw error;
  const candidates = (rows ?? []).filter((r) => r.id !== exclude);
  if (candidates.length === 0) return { kind: 'none' };

  const trashedSamePet = candidates.find(
    (r) => r.zwierze_id === currentPetId && Boolean(r.deleted_at),
  );
  if (trashedSamePet) {
    return {
      kind: 'trashed_same_pet',
      trashed_same_pet: {
        id: String(trashedSamePet.id),
        title: String(trashedSamePet.title ?? ''),
        test_date: String(trashedSamePet.test_date ?? ''),
        deleted_at: String(trashedSamePet.deleted_at),
      },
    };
  }

  const extractPetMeta = (
    petField: unknown,
  ): { imie: string; archived_at: string | null } => {
    const item = Array.isArray(petField) ? petField[0] : petField;
    const obj = (item ?? {}) as { imie?: string; archived_at?: string | null };
    return {
      imie: String(obj.imie ?? ''),
      archived_at: obj.archived_at ? String(obj.archived_at) : null,
    };
  };

  const activeOtherPet = candidates.find(
    (r) => r.zwierze_id !== currentPetId && !r.deleted_at,
  );
  if (activeOtherPet) {
    const petMeta = extractPetMeta(activeOtherPet.pet);
    return {
      kind: 'household_match',
      household_match: {
        id: String(activeOtherPet.id),
        pet_id: String(activeOtherPet.zwierze_id),
        pet_name: petMeta.imie,
        pet_archived: Boolean(petMeta.archived_at),
        title: String(activeOtherPet.title ?? ''),
        test_date: String(activeOtherPet.test_date ?? ''),
        status: 'active',
        deleted_at: null,
      },
    };
  }

  const trashedOtherPet = candidates.find(
    (r) => r.zwierze_id !== currentPetId && Boolean(r.deleted_at),
  );
  if (trashedOtherPet) {
    const petMeta = extractPetMeta(trashedOtherPet.pet);
    return {
      kind: 'household_match',
      household_match: {
        id: String(trashedOtherPet.id),
        pet_id: String(trashedOtherPet.zwierze_id),
        pet_name: petMeta.imie,
        pet_archived: Boolean(petMeta.archived_at),
        title: String(trashedOtherPet.title ?? ''),
        test_date: String(trashedOtherPet.test_date ?? ''),
        status: 'trashed',
        deleted_at: trashedOtherPet.deleted_at ? String(trashedOtherPet.deleted_at) : null,
      },
    };
  }

  return { kind: 'none' };
}

export async function loadReusableReportById(
  client: SupabaseClient,
  householdId: string,
  reportId: string,
) {
  const { data: rep, error } = await client
    .from('wynik_badania')
    .select(
      'id,gospodarstwo_id,title,test_date,laboratory,doctor,notes,ai_interpretation,rows:pomiar_parametru(ordinal,name,value,unit,reference,category,correction:measurement_correction(value,unit,reference))',
    )
    .eq('id', reportId)
    .eq('gospodarstwo_id', householdId)
    .maybeSingle();

  if (error || !rep) return null;

  const rawRows = (Array.isArray(rep.rows) ? rep.rows : []) as Array<{
    ordinal?: number | null;
    name?: string | null;
    value?: string | null;
    unit?: string | null;
    reference?: string | null;
    category?: string | null;
    correction?:
      | { value?: string | null; unit?: string | null; reference?: string | null }
      | Array<{ value?: string | null; unit?: string | null; reference?: string | null }>
      | null;
  }>;

  const normalizedRows = rawRows
    .slice()
    .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0))
    .map((row) => {
      const corr = Array.isArray(row.correction) ? row.correction[0] : row.correction;
      const cat = String(row.category ?? 'other');
      return {
        name: String(row.name ?? ''),
        value: String(corr?.value ?? row.value ?? ''),
        unit: String(corr?.unit ?? row.unit ?? ''),
        reference: String(corr?.reference ?? row.reference ?? ''),
        category: ['blood', 'renal', 'liver', 'other'].includes(cat) ? cat : 'other',
      };
    });

  return {
    title: String(rep.title ?? ''),
    test_date: String(rep.test_date ?? ''),
    laboratory: String(rep.laboratory ?? ''),
    doctor: String(rep.doctor ?? ''),
    notes: String(rep.notes ?? ''),
    ai_interpretation: String(rep.ai_interpretation ?? ''),
    rows: normalizedRows,
  };
}

export async function findRejectedHash(
  adminClient: SupabaseClient,
  householdId: string,
  hash: string,
): Promise<RejectedHashRecord | null> {
  const { data, error } = await adminClient.rpc('get_rejected_document_hash', {
    p_household_id: householdId,
    p_source_sha256: hash,
  });

  if (error || !data || typeof data !== 'object') return null;
  const record = data as { document_type?: string; reason?: string };
  const docType =
    record.document_type === 'unreadable' ? 'unreadable' : 'non_medical';
  return {
    document_type: docType,
    reason: String(record.reason ?? ''),
  };
}

export async function rememberRejectedHash(
  adminClient: SupabaseClient,
  householdId: string,
  hash: string,
  documentType: 'non_medical' | 'unreadable',
  reason: string,
): Promise<void> {
  const { error } = await adminClient.rpc('remember_rejected_document_hash', {
    p_household_id: householdId,
    p_source_sha256: hash,
    p_document_type: documentType,
    p_rejection_reason: reason.slice(0, 300),
  });
  if (error) {
    console.error('remember_rejected_hash_failed', error.code ?? error.message);
  }
}
