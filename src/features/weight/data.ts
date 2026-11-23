import 'server-only';
import {createClient} from '@/lib/supabase/server';
import type {WeightMeasurement} from './types';
export async function listWeights(petId:string):Promise<WeightMeasurement[]>{
 const client=await createClient();if(!client)throw Error('Supabase unavailable');
 const {data,error}=await client.from('pet_weight').select('*').eq('pet_id',petId).order('measured_on',{ascending:false}).order('created_at',{ascending:false}).limit(500);
 if(error)throw Error('Could not load weights');return data;
}
