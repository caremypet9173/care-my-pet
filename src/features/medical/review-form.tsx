"use client";
import {measurementValueType,validMeasurementValue} from "../../../supabase/functions/medical-reports/value-type.mjs";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocale } from "next-intl";
import { IconFileText, IconPlus, IconArrowLeft, IconSparkles, IconAlertTriangle, IconClipboardText } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Pet } from "@/features/pets/types";
import { medicalMessages } from "./messages";
import type { Measurement, ReportDraft } from "./types";
import { PdfPreview } from "./pdf-preview";
import { ReviewParameter } from "./review-parameter";
import { rangeStatus } from "./comparison";
const blank = ():ReportDraft => ({title:"",test_date:"",laboratory:"",doctor:"",notes:"",rows:[]});
const maxFile=6*1024*1024;
const extensions:Record<string,string>={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png"};
export function ReviewForm({pet}:{pet:Pet}) {
  const t=medicalMessages[useLocale()];const router=useRouter();
  const [file,setFile]=useState<File|null>(null);const [preview,setPreview]=useState("");
  const [draft,setDraft]=useState<ReportDraft>(blank);const [reviewing,setReviewing]=useState(false);
  const [checked,setChecked]=useState<boolean[]>([]);const [confirmed,setConfirmed]=useState(false);
  const [patient,setPatient]=useState("");const [busy,setBusy]=useState<"read"|"save"|"check"|null>(null);
  const [readAutomatically,setReadAutomatically]=useState(false);
  const [duplicate,setDuplicate]=useState<{id:string;title:string;test_date:string}|null>(null);
  const [submitted,setSubmitted]=useState(false);
  const today=new Date().toISOString().slice(0,10);
  const titleInvalid=!draft.title.trim();
  const dateInvalid=!/^\d{4}-\d{2}-\d{2}$/.test(draft.test_date)||draft.test_date<"1900-01-01"||draft.test_date>today||Number.isNaN(Date.parse(draft.test_date))||new Date(draft.test_date).toISOString().slice(0,10)!==draft.test_date;
  const [error,setError]=useState("");const [ai,setAi]=useState<boolean|null>(null);const [zoom,setZoom]=useState(100);
  const upload=useRef<{id:string;path:string;uploaded:boolean}|null>(null);const saved=useRef(false);
  const validationSummary=useRef<HTMLDivElement>(null);
  const feedback=useRef<HTMLDivElement>(null);
  const duplicateNotice=useRef<HTMLElement>(null);
  const checkingNotice=useRef<HTMLParagraphElement>(null);
  const [candidate,setCandidate]=useState<File|null>(null);
  const choosing=useRef(false);
  const fileInput=useRef<HTMLInputElement>(null);const form=useRef<HTMLFormElement>(null);
  const back=`/app/zwierzeta/${pet.id}?tab=results`;
  useEffect(()=>{
    const notice=duplicate?duplicateNotice.current:error&&error!==t.validation?feedback.current:busy==='check'?checkingNotice.current:null;
    notice?.focus({preventScroll:true});notice?.scrollIntoView({behavior:'smooth',block:'center'});
  },[duplicate,error,busy,t.validation]);
  useEffect(()=>{let active=true;createClient().functions.invoke("medical-reports",{body:{action:"capabilities",pet_id:pet.id}}).then(({data,error})=>{if(active)setAi(!error&&data?.extraction===true);});return()=>{active=false;};},[pet.id]);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  useEffect(()=>{if(!file)return;const guard=(event:BeforeUnloadEvent)=>{if(!saved.current){event.preventDefault();event.returnValue="";}};window.addEventListener("beforeunload",guard);return()=>window.removeEventListener("beforeunload",guard);},[file]);
  async function choose(next?:File){
    if(!next||busy||choosing.current)return;
    if(file&&!window.confirm(t.resetWarning))return;
    choosing.current=true;setCandidate(next);setBusy('check');setDuplicate(null);setError('');
    try{
    const bytes=new Uint8Array(await next.slice(0,8).arrayBuffer());
    const valid=next.type==="application/pdf"?new TextDecoder().decode(bytes.slice(0,5))==="%PDF-":next.type==="image/jpeg"?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:next.type==="image/png"&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
    if(!extensions[next.type] || !next.size || next.size>maxFile || !valid){setError(t.fileError);return;}
      const digest=await crypto.subtle.digest('SHA-256',await next.arrayBuffer());
      const sha256=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
      const controller=new AbortController();
      let timer:ReturnType<typeof setTimeout>|undefined;
      const {data,error}=await Promise.race([
        createClient().functions.invoke('medical-reports',{body:{action:'check_duplicate',pet_id:pet.id,sha256},signal:controller.signal}),
        new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('check_timeout'));},30000);})
      ]).finally(()=>clearTimeout(timer));
      if(error)throw error;
      if(data.duplicate){setDuplicate(data.duplicate);return;}
    // Clean up only a pending unlinked source. RLS prevents deleting a confirmed source.
    if(upload.current?.uploaded)await createClient().storage.from("medical-documents").remove([upload.current.path]);
    upload.current=null;setFile(next);setPreview(URL.createObjectURL(next));setDraft(blank());setSubmitted(false);setChecked([]);setConfirmed(false);setPatient("");setReadAutomatically(false);setReviewing(false);setError("");setZoom(100);setCandidate(null);
    }catch{setError(t===medicalMessages.pl?"Nie udało się sprawdzić pliku. Nie został dodany. Spróbuj ponownie. To nie oznacza, że dokument jest duplikatem.":"Could not check the file. It has not been added. Please retry. This does not mean it is a duplicate.");}
    finally{choosing.current=false;setBusy(null);}
  }
  function update(field:keyof Omit<ReportDraft,"rows">,value:string){setDraft(current=>({...current,[field]:value}));setConfirmed(false);}
  function updateRow(index:number,field:keyof Measurement,value:string){setDraft(current=>({...current,rows:current.rows.map((row,i)=>i===index?{...row,[field]:value}:row)}));setChecked(current=>current.map((v,i)=>i===index?false:v));setConfirmed(false);}
  async function extract(){
    if(!file||busy||duplicate)return;
    if(reviewing&&!window.confirm(t.resetWarning))return;
    setBusy("read");setError("");setSubmitted(false);
    try{
      const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(file);});
      const {data,error}=await createClient().functions.invoke("medical-reports",{body:{action:"extract",pet_id:pet.id,mime:file.type,file:base64}});
      if(error){const details=await error.context?.json?.().catch(()=>null);if(details?.duplicate){setDuplicate(details.duplicate);return;}throw new Error(details?.error??"extraction_failed");}
      setDraft({...data.report,rows:data.report.rows.map((row:Measurement)=>({...row,value_type:measurementValueType(row)}))});setPatient(data.patient_name);setChecked(data.report.rows.map(()=>false));setConfirmed(false);setReadAutomatically(true);setReviewing(true);
    }catch(error){setError(error instanceof Error&&error.message==="daily_limit"?t.limit:error instanceof Error&&error.message==="ai_billing"?t.aiBilling:t.aiError);}finally{setBusy(null);}
  }
  async function save(event:FormEvent){
    event.preventDefault();if(!file||busy||duplicate)return;
    setSubmitted(true);
    if(issues.length){setError(t.validation);requestAnimationFrame(()=>{validationSummary.current?.focus({preventScroll:true});validationSummary.current?.scrollIntoView({behavior:"smooth",block:"center"});});return;}
    setBusy("save");setError("");
    try{
      const client=createClient();const {data:{user}}=await client.auth.getUser();if(!user)throw new Error();
      if(!upload.current){const id=crypto.randomUUID();upload.current={id,path:`${pet.gospodarstwo_id}/${user.id}/${id}.${extensions[file.type]}`,uploaded:false};}
      if(!upload.current.uploaded){
        const {error}=await client.storage.from("medical-documents").upload(upload.current.path,file,{contentType:file.type,upsert:false,cacheControl:"0"});
        if(error&&String((error as {statusCode?:string}).statusCode)!=="409")throw error;
        upload.current.uploaded=true;
      }
      const {data,error}=await client.functions.invoke("medical-reports",{body:{action:"confirm",id:upload.current.id,pet_id:pet.id,source_name:file.name.slice(0,180),source_mime:file.type,report:draft,confirmed:true}});
      if(error||!data?.id){const details=await error?.context?.json?.().catch(()=>null);if(details?.duplicate){setDuplicate(details.duplicate);setBusy(null);return;}throw new Error(details?.error??"save_failed");}
      saved.current=true;router.push(`${back}&report=${encodeURIComponent(data.id)}`);router.refresh();
    }catch(error){setError(error instanceof Error&&error.message==="already_confirmed"?t.alreadyConfirmed:t.saveError);setBusy(null);}
  }
  const outside=draft.rows.filter(row=>["above","below"].includes(rangeStatus(row)));
  const pl=t===medicalMessages.pl;
  const issues:{target:string;text:string}[]=[];
  if(dateInvalid)issues.push({target:"review-test_date",text:pl?"Podaj datę badania (nie późniejszą niż dzisiaj).":"Enter the test date (no later than today)."});
  if(titleInvalid)issues.push({target:"review-title",text:pl?"Uzupełnij nazwę badania.":"Enter the report title."});
  draft.rows.forEach((row,index)=>{
    const label=`${index+1}. ${row.name.trim()||(pl?"Parametr bez nazwy":"Unnamed parameter")}`;
    if(!row.name.trim())issues.push({target:`review-row-${index}-name`,text:pl?`${label}: wpisz nazwę parametru.`:`${label}: enter the parameter name.`});
    if(!validMeasurementValue(row.value,measurementValueType(row)))issues.push({target:`review-row-${index}-value`,text:pl?`${label}: uzupełnij poprawny wynik.`:`${label}: enter a valid result.`});
    if(!checked[index])issues.push({target:`review-row-${index}-check`,text:pl?`${label}: porównaj z oryginałem i kliknij „Potwierdź zgodność z oryginałem”.`:`${label}: compare with the original and tick the confirmation.`});
  });
  if(!confirmed)issues.push({target:"review-confirm",text:pl?"Zaznacz potwierdzenie pupila, daty i poprawności wszystkich danych.":"Tick the confirmation of the pet, date and all data."});
  function goToIssue(id:string){const control=document.getElementById(id);control?.focus({preventScroll:true});control?.scrollIntoView({behavior:"smooth",block:"center"});}
  return <div className="medical-review">
    <header className="medical-process-header"><Link href={back} onClick={event=>{if(busy||(file&&!window.confirm(t.cancelWarning)))event.preventDefault();}}><IconArrowLeft size={18}/>{t.back}</Link><div><strong>{pet.imie}</strong><span>{t.review}</span></div><span className="household-tag">{t.step}</span></header>
    <h1 className="sr-only">{t.review}</h1>
    <input ref={fileInput} className="sr-only" tabIndex={-1} type="file" accept="application/pdf,image/jpeg,image/png" aria-label={t.choose} disabled={!!busy} onChange={event=>{void choose(event.target.files?.[0]);event.target.value="";}}/>
    {error&&error!==t.validation&&<div ref={feedback} tabIndex={-1} role="alert" className="medical-error"><p>{error}</p>{candidate&&<Button variant="secondary" disabled={!!busy} onClick={()=>void choose(candidate??undefined)}>{pl?"Spróbuj ponownie":"Try again"}</Button>}</div>}
    {busy==="check"&&<p ref={checkingNotice} tabIndex={-1} className="review-save-note" role="status">{pl?"Sprawdzanie, czy dokument jest już w kartotece…":"Checking for an existing document…"}</p>}
    {duplicate&&<section ref={duplicateNotice} tabIndex={-1} className="review-duplicate" role="alert"><IconFileText size={24} aria-hidden="true"/><div><h2>{pl?"Ten dokument jest już w kartotece":"This document is already in the record"}</h2><p>{duplicate.title} · {duplicate.test_date}</p><p>{pl?"Nie ma potrzeby ponownego odczytu ani dodawania tego samego pliku.":"There is no need to read or add the same file again."}</p><div className="review-duplicate-actions"><Link href={`${back}&report=${duplicate.id}`} onClick={()=>{saved.current=true;}}>{pl?"Otwórz istniejące badanie":"Open existing report"}</Link><button type="button" onClick={()=>fileInput.current?.click()} disabled={!!busy}>{t.changeFile}</button></div></div></section>}
    {!file?<section className="medical-upload"><IconFileText size={40} aria-hidden="true"/><h2>{t.add}</h2><p>{t.fileHint}</p><Button onClick={()=>fileInput.current?.click()} disabled={!!busy} loading={busy==="check"}>{busy==="check"?(pl?"Sprawdzanie pliku…":"Checking file…"):t.choose}</Button></section>:<div className="medical-split">
      <section className="medical-original" aria-label={t.original}><header><strong>{file.name}</strong><a href={preview||undefined} target="_blank" rel="noopener noreferrer">{t.open}</a></header>
        {file.type==="application/pdf"?(preview&&<PdfPreview key={preview} url={preview}/>):<><label className="medical-zoom">{t.zoom}<input type="range" min={50} max={200} value={zoom} onChange={event=>setZoom(Number(event.target.value))}/></label><div className="medical-image-scroll" tabIndex={0} role="region" aria-label={t.zoom}>{/* Private local blob, never passed to an image optimization service. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview&&<img src={preview} alt={t.original} style={{width:`${zoom}%`,maxWidth:"none"}}/>}</div></>}
        <Button variant="ghost" onClick={()=>fileInput.current?.click()} disabled={!!busy}>{t.changeFile}</Button>
      </section>
      <div className="medical-edit">{!reviewing?<section className="medical-reading"><p>{t.aiHint}</p><div><Button onClick={extract} disabled={ai!==true||!!busy||!!duplicate} loading={busy==="read"}><IconSparkles size={18}/>{busy==="read"?t.reading:t.extract}</Button><Button variant="secondary" disabled={!!busy||!!duplicate} onClick={()=>setReviewing(true)}>{t.manual}</Button></div>{ai===false&&<p>{t.aiMissing}</p>}{busy==="read"&&<p role="status">{t.reading}</p>}</section>:null}
      {reviewing&&<form ref={form} noValidate onSubmit={save} className="medical-review-form"><fieldset disabled={!!busy||!!duplicate}>
        {outside.length>0&&<aside className="review-attention"><IconAlertTriangle size={23} aria-hidden="true"/><div><strong>{pl?`Wskaźniki poza zakresem z dokumentu: ${outside.length}.`:`${outside.length} parameters outside the document range.`}</strong><p>{pl?"Sprawdź, czy wartość i jednostka na skanie po lewej stronie odpowiadają odczytowi. Możesz ręcznie skorygować dowolne pole.":"Check the value and unit against the original on the left. You can correct any field."}</p></div><span>{pl?"Wymaga uwagi":"Needs review"}</span></aside>}
        <section className="medical-metadata"><header className="review-section-heading"><h2><IconClipboardText size={17}/>{t.metadata}</h2><span className="review-source-badge">{readAutomatically?(pl?"Odczytane automatycznie":"Automatically extracted"):(pl?"Wpisywane ręcznie":"Manual entry")}</span></header><div className="medical-fields">{([['test_date',t.date,10],['laboratory',t.lab,160],['doctor',t.doctor,160],['title',t.title,160]] as const).map(([key,label,max])=><label key={key}>{label}{(key==="title"||key==="test_date")&&" *"}<input id={`review-${key}`} type={key==="test_date"?"date":"text"} value={draft[key]} aria-invalid={submitted&&(key==="title"?titleInvalid:key==="test_date"?dateInvalid:false)} aria-describedby={submitted&&(key==="title"?titleInvalid:key==="test_date"?dateInvalid:false)?`review-error-${key}`:undefined} required={key==="title"||key==="test_date"} maxLength={max} min={key==="test_date"?"1900-01-01":undefined} max={key==="test_date"?new Date().toISOString().slice(0,10):undefined} onChange={event=>update(key,event.target.value)}/>{submitted&&((key==="title"&&titleInvalid)||(key==="test_date"&&dateInvalid))&&<span className="review-field-error" id={`review-error-${key}`}>{key==="title"?(pl?"Uzupełnij nazwę badania.":"Enter the report title."):(pl?"Podaj poprawną datę, nie późniejszą niż dzisiaj.":"Enter a valid date, no later than today.")}</span>}</label>)}</div><p className="review-patient-line">{t.patientHint} <strong>{pet.imie}</strong>{patient&&<> · {t.patient}: <strong>{patient}</strong></>}</p></section>
        <section className="medical-parameters"><header className="review-section-heading"><div><h2>{pl?"Wyodrębnione parametry laboratoryjne":t.parameters} <small>({draft.rows.length})</small></h2><span className="review-species">{pet.gatunek==="cat"?"Felis catus":"Canis familiaris"}</span></div><Button variant="ghost" disabled={draft.rows.length>=100} onClick={()=>{setDraft(current=>({...current,rows:[...current.rows,{name:"",value:"",unit:"",reference:"",category:"other"}]}));setChecked(current=>[...current,false]);setConfirmed(false);}}><IconPlus size={16}/>{t.addRow}</Button></header>
          {draft.rows.map((row,index)=><ReviewParameter key={index} row={row} index={index} checked={checked[index]??false} submitted={submitted} onChange={(field,value)=>updateRow(index,field,value)} onCheck={value=>{setChecked(current=>current.map((v,i)=>i===index?value:v));setConfirmed(false);}} onRemove={()=>{setDraft(current=>({...current,rows:current.rows.filter((_,i)=>i!==index)}));setChecked(current=>current.filter((_,i)=>i!==index));setConfirmed(false);}}/>)}
        </section>
        <details className="review-source-notes" open={draft.notes?true:undefined}><summary><IconClipboardText size={18}/>{t.notes}</summary><label><span className="sr-only">{t.notes}</span><textarea maxLength={4000} rows={3} value={draft.notes} onChange={event=>update("notes",event.target.value)}/></label></details>
        <label className="medical-confirm"><input id="review-confirm" type="checkbox" aria-invalid={submitted&&!confirmed} aria-describedby={submitted&&!confirmed?"review-confirm-error":undefined} checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>{t.confirm}</label>
        {submitted&&!confirmed&&<p className="review-field-error" id="review-confirm-error">{pl?"Potwierdź pupila, datę i poprawność danych przed zapisaniem.":"Confirm the pet, date and data before saving."}</p>}
        <p className="review-save-note"><IconFileText size={18}/>{t.notSaved}</p>
        {submitted&&issues.length>0&&<div ref={validationSummary} className="review-validation-summary" role="alert" tabIndex={-1} aria-labelledby="review-validation-title"><h2 id="review-validation-title">{pl?"Badanie nie zostało zapisane. Uzupełnij wymagane pola i potwierdzenia:":"The report has not been saved. Complete the required fields and confirmations:"}</h2><p>{pl?"Kliknij pozycję, aby przejść do miejsca wymagającego uwagi. Lista skraca się po poprawieniu danych.":"Select an item to go to it. Resolved items disappear from this list."}</p><ul>{issues.map(issue=><li key={issue.target}><button type="button" onClick={()=>goToIssue(issue.target)}>{issue.text}</button></li>)}</ul></div>}
        <footer className="medical-confirm-bar"><Button variant="ghost" onClick={extract} disabled={ai!==true||!!busy||!!duplicate} loading={busy==="read"}><IconSparkles size={16}/>{t.extract}</Button><Button type="submit" loading={busy==="save"}>{t.save} →</Button></footer>
      </fieldset></form>}
      </div>
    </div>}

  </div>;
}
