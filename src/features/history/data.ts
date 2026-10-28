import 'server-only';
import {createClient} from '@/lib/supabase/server';
import type {HealthEvent} from './types';

export async function listHealthEvents(petId: string): Promise<HealthEvent[]> {
  const client = await createClient();
  if (!client) throw Error('Supabase unavailable');
  const {data, error} = await client
    .from('pet_health_event')
    .select('*')
    .eq('pet_id', petId)
    .order('event_date', {ascending: false})
    .order('created_at', {ascending: false})
    .limit(300);
  if (error) throw Error('Could not load health events');
  return data;
}

export async function listHouseholdHealthEvents(
  householdId?: string | null,
): Promise<HealthEvent[]> {
  const client = await createClient();
  if (!client) return [];
  let query = client
    .from('pet_health_event')
    .select('*')
    .order('event_date', {ascending: false})
    .order('created_at', {ascending: false})
    .limit(500);
  if (householdId) {
    query = query.eq('household_id', householdId);
  }
  const {data, error} = await query;
  if (error) return [];
  return data ?? [];
}
