import {createClient} from 'npm:@supabase/supabase-js@2.117.3';
import {validateWeight} from './validation.mjs';
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'private, no-store'};
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers});
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
 const token=req.headers.get('Authorization');if(!token?.startsWith('Bearer '))return reply({error:'unauthorized'},401);
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:{user},error}=await client.auth.getUser(token.slice(7));if(error||!user||user.is_anonymous)return reply({error:'unauthorized'},401);
 try{
  const reader=req.body?.getReader();if(!reader)return reply({error:'invalid_input'},400);let size=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return reply({error:'too_large'},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const body=JSON.parse(new TextDecoder().decode(bytes));const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if(body.action==='delete'){
   if(!uuid.test(body.id??'')||!uuid.test(body.pet_id??'')||!Number.isInteger(body.revision)||body.revision<1)return reply({error:'invalid_input'},400);
   const {error}=await client.rpc('delete_pet_weight',{p_id:body.id,p_pet_id:body.pet_id,p_revision:body.revision});
   if(error)return reply({error:error.code==='PT409'?'conflict':error.code==='PT423'?'pet_archived':error.code==='PT428'?'recovery_key_required':'delete_failed'},error.code==='PT409'?409:error.code==='PT423'?423:error.code==='PT428'?428:400);
   return reply({deleted:true});
  }
  const parsed=validateWeight(body.measurement);
  if(!parsed.value||!uuid.test(body.id??'')||!uuid.test(body.pet_id??'')||!Number.isInteger(body.revision)||body.revision<0)return reply({error:'invalid_input',fields:parsed.errors},400);
  const {data,error}=await client.rpc('save_pet_weight',{p_id:body.id,p_pet_id:body.pet_id,p_revision:body.revision,p_kg:parsed.value.kg,p_date:parsed.value.measured_on,p_note:parsed.value.note});
  if(error)return reply({error:error.code==='PT409'?'conflict':error.code==='PT423'?'pet_archived':error.code==='PT428'?'recovery_key_required':'save_failed'},error.code==='PT409'?409:error.code==='PT423'?423:error.code==='PT428'?428:error.code==='42501'||error.code==='P0002'?404:400);
  return reply({measurement:data});
 }catch{return reply({error:'invalid_request'},400);}
});
