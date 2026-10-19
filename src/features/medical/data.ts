import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MedicalReport, MeasurementCorrection } from "./types";
export async function listReports(petId:string,requestedId?:string):Promise<MedicalReport[]> {
  const client=await createClient();
  if(!client) throw new Error("Supabase unavailable");
  const {data,error}=await client.from("wynik_badania").select("*,rows:pomiar_parametru(*,correction:measurement_correction(*))").eq("zwierze_id",petId).order("test_date",{ascending:false}).order("confirmed_at",{ascending:false}).limit(100);
  if(error)throw new Error("Could not load reports");
  if(requestedId&&/^[0-9a-f-]{36}$/i.test(requestedId)&&!data.some(r=>r.id===requestedId)){
    const extra=await client.from("wynik_badania").select("*,rows:pomiar_parametru(*,correction:measurement_correction(*))").eq("zwierze_id",petId).eq("id",requestedId).maybeSingle();
    if(extra.error)throw new Error("Could not load report");
    if(extra.data)data.push(extra.data);
  }
  return (data as (Omit<MedicalReport,"rows"> & {rows:(MedicalReport['rows'][number]&{correction:MeasurementCorrection|null})[]})[]).map(report=>({...report,rows:report.rows.map(({correction,...row})=>({...row,original:{value:row.value,unit:row.unit,reference:row.reference},...(correction?{value:correction.value,unit:correction.unit,reference:correction.reference,note:correction.note,is_key:correction.is_key,revision:correction.revision}:{revision:0})})).sort((a,b)=>(a.ordinal??0)-(b.ordinal??0))}));
}
