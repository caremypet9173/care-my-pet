import {createClient,type SupabaseClient} from 'npm:@supabase/supabase-js@2.117.3';
export async function fileHash(bytes: Uint8Array) {
 const hash = await crypto.subtle.digest('SHA-256', bytes);
 return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2,'0')).join('');
}
// Read through the caller's RLS. Only the derived hash of an already authorized
// document is backfilled with the service client; document data stays unchanged.
export async function findDuplicate(client: SupabaseClient, petId: string, hash: string, exclude?: string) {
 const {data:known,error}=await client.from('wynik_badania').select('id,title,test_date').eq('zwierze_id',petId).eq('source_sha256',hash).order('confirmed_at').limit(2);
 if(error)throw error;
 const match=known?.find(row=>row.id!==exclude);if(match)return match;
 for(;;){
  const {data:legacy,error}=await client.from('wynik_badania').select('id,title,test_date,source_path').eq('zwierze_id',petId).is('source_sha256',null).order('id').limit(100);
  if(error)throw error;
  for(const row of legacy??[]){
   const {data:file,error}=await client.storage.from('medical-documents').download(row.source_path);
   if(error||!file)throw new Error('duplicate_check_failed');
   const digest=await fileHash(new Uint8Array(await file.arrayBuffer()));
   const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
   const {error:cacheError}=await admin.from('wynik_badania').update({source_sha256:digest}).eq('id',row.id).eq('zwierze_id',petId).is('source_sha256',null);
   if(cacheError)throw cacheError;
   if(digest===hash&&row.id!==exclude)return {id:row.id,title:row.title,test_date:row.test_date};
  }
  if(!legacy||legacy.length<100)return null;
 }
}
