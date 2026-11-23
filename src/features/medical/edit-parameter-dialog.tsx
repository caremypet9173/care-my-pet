"use client";
import "@/styles/medical-edit-dialog.css";
import {useEffect,useRef,useState} from "react";
import {useLocale} from "next-intl";
import {IconX,IconScan,IconAlertTriangle,IconDeviceFloppy,IconRestore} from "@tabler/icons-react";
import {createClient} from "@/lib/supabase/client";
import {numeric,rangeStatus} from "./comparison";
import {acceptsNumberInput} from "./number-input";
import {measurementValueType,validMeasurementValue} from "../../../supabase/functions/medical-reports/value-type.mjs";
import type {Measurement,MeasurementCorrection,MedicalReport} from "./types";

export function EditParameterDialog({row,report,petId,onCancel,onSave}:{row:Measurement;report:MedicalReport;petId:string;onCancel:()=>void;onSave:(correction:MeasurementCorrection)=>void}){
 const pl=useLocale()==="pl";const dialog=useRef<HTMLDialogElement>(null);
 const original=row.original??row;
 const valueType=measurementValueType({...row,...original});
 const [valueTouched,setValueTouched]=useState(false);
 const split=(text:string)=>text.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*[-–—]\s*(-?\d+(?:[.,]\d+)?)\s*$/);
 const initialRange=split(row.reference);
 const [value,setValue]=useState(row.value),[unit,setUnit]=useState(row.unit),[low,setLow]=useState(initialRange?.[1]??""),[high,setHigh]=useState(initialRange?.[2]??"");
 const [reference,setReference]=useState(row.reference),[textRange,setTextRange]=useState(!!row.reference&&!initialRange);
 const [note,setNote]=useState(row.note??""),[key,setKey]=useState(row.is_key??false),[saving,setSaving]=useState(false),[error,setError]=useState("");
 const [rangeChanged,setRangeChanged]=useState(false);
 const currentReference=rangeChanged?(textRange?reference:low||high?`${low}–${high}`:""):reference;
 const status=rangeStatus({...row,value,unit,reference:currentReference});
 const limits=split(currentReference);const number=numeric(value);
 const difference=number!==null&&limits&&(status==="above"||status==="below")?number-numeric(limits[status==="above"?2:1])!:null;
 const deviation=difference===null?"":` (${new Intl.NumberFormat(pl?"pl":"en",{maximumSignificantDigits:8,signDisplay:"always"}).format(difference)} ${unit})`;
 const units=Array.from(new Set([row.unit,original.unit,"mg/dl","µmol/l","g/l","g/dl","U/l","mmol/l","%",""]));
 const [customUnit,setCustomUnit]=useState(false);
 useEffect(()=>{const el=dialog.current!;const focused=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;el.showModal();document.body.style.overflow="hidden";return()=>{el.close();document.body.style.overflow=overflow;focused?.focus();};},[]);
 async function save(event:React.FormEvent){
  event.preventDefault();if(saving)return;setError("");
  setValueTouched(true);
  if(!validMeasurementValue(value,valueType))return;
  if(!value.trim()||(!textRange&&rangeChanged&&(!!low!==!!high||low&&high&&(numeric(low)===null||numeric(high)===null||numeric(low)!>numeric(high)!)))){setError(pl?"Sprawdź wartość i granice zakresu.":"Check the value and range limits.");return;}
  setSaving(true);
  try{const {data,error}=await createClient().functions.invoke("medical-reports",{body:{action:"correct",pet_id:petId,measurement_id:row.id,revision:row.revision??0,correction:{value,unit,reference:currentReference,note,is_key:key}}});
   if(error){setError(error.context?.status===409?(pl?"Wynik zmieniono w innym oknie. Zamknij dialog i odśwież stronę przed ponowną edycją.":"This result changed elsewhere. Close the dialog and refresh before editing again."):(pl?"Nie udało się zapisać zmian. Spróbuj ponownie.":"Could not save changes. Please retry."));return;}
   onSave(data.correction);
  }catch{setError(pl?"Nie udało się zapisać zmian. Spróbuj ponownie.":"Could not save changes. Please retry.");}finally{setSaving(false);}
 }
 function restore(){const match=split(original.reference);setValue(original.value);setUnit(original.unit);setReference(original.reference);setLow(match?.[1]??"");setHigh(match?.[2]??"");setTextRange(!!original.reference&&!match);setRangeChanged(false);setCustomUnit(false);}
 const labels={above:pl?"Wartość powyżej zakresu":"Value above range",below:pl?"Wartość poniżej zakresu":"Value below range",within:pl?"Wartość w zakresie":"Value within range",unknown:pl?"Brak porównania z zakresem":"No range comparison"};
 return <dialog ref={dialog} className="medical-edit-dialog" aria-labelledby="edit-parameter-title" onCancel={event=>{event.preventDefault();if(!saving)onCancel();}}>
  <form onSubmit={save}><header><div><h2 id="edit-parameter-title"><span className={`edit-status-dot edit-status-dot--${status}`}/>{pl?"Edycja parametru laboratoryjnego":"Edit laboratory parameter"}</h2><p>{row.name} · {pl?"Badanie z":"Test from"} {report.test_date}{report.laboratory&&` (${report.laboratory})`}</p></div><button type="button" className="edit-close" aria-label={pl?"Zamknij okno":"Close dialog"} disabled={saving} onClick={onCancel}><IconX size={20}/></button></header>
  <fieldset disabled={saving} className="edit-parameter-body">
   <div className="edit-source"><IconScan size={18} aria-hidden="true"/><p><strong>{pl?"Źródło odczytu:":"Reading source:"}</strong> {pl?"Wynik pochodzi z pliku":"Result from"} <span>{report.source_name}</span>. {pl?"Możesz go ręcznie skorygować w razie błędu odczytu.":"You can manually correct a reading error."}</p></div>
   <div className="edit-two-columns"><label>{pl?"Wartość wyniku *":"Result value *"}<span className="edit-value"><input autoFocus required maxLength={60} value={value} aria-describedby="parameter-value-type parameter-value-error" aria-invalid={valueTouched&&!validMeasurementValue(value,valueType)} onBlur={()=>setValueTouched(true)} inputMode={valueType==="decimal"?"decimal":"text"} onChange={e=>{if(valueType!=="decimal"||acceptsNumberInput(e.target.value))setValue(e.target.value);}} style={{textAlign:numeric(value)!==null?"right":"left"}}/><span aria-hidden="true">{unit}</span></span></label><label>{pl?"Jednostka miary":"Unit"}<select value={customUnit?"__custom":unit} onChange={e=>{setCustomUnit(e.target.value==="__custom");if(e.target.value!=="__custom")setUnit(e.target.value);}}>{units.map(u=><option key={u} value={u}>{u||(pl?"Bez jednostki":"No unit")}</option>)}<option value="__custom">{pl?"Inna jednostka…":"Other unit…"}</option></select></label></div>
   <div className="edit-value-validation"><p id="parameter-value-type">{pl?"Typ wartości: ":"Value type: "}<strong>{valueType==="decimal"?(pl?"liczba dziesiętna":"decimal number"):(pl?"tekst / wynik opisowy":"text / descriptive result")}</strong>{valueType==="decimal"&&<span>{pl?". Np. 1,7 lub 1.7; dopuszczalne także <0,5 i >10.":". E.g. 1.7 or 1,7; <0.5 and >10 are also accepted."}</span>}</p><p id="parameter-value-error" role={valueTouched&&!validMeasurementValue(value,valueType)?"alert":undefined}>{valueTouched&&!validMeasurementValue(value,valueType)&&(valueType==="decimal"?(pl?"Wpisz poprawną liczbę. Ten parametr nie przyjmuje dowolnego tekstu.":"Enter a valid number. This parameter does not accept free text."):(pl?"Wpisz wynik (maks. 60 znaków).":"Enter a result (max. 60 characters)."))}</p></div>
   {customUnit&&<label>{pl?"Wpisz jednostkę":"Enter unit"}<input maxLength={40} value={unit} onChange={e=>setUnit(e.target.value)}/></label>}
   <div className="edit-reference"><p>{pl?"Zakres referencyjny normy":"Reference range"}</p>{textRange?<label>{pl?"Zakres z dokumentu":"Range from document"}<input maxLength={100} value={reference} onChange={e=>{setReference(e.target.value);setRangeChanged(true);}}/></label>:<div className="edit-two-columns"><label>{pl?"Dolna granica":"Lower limit"}<input maxLength={45} value={low} inputMode="decimal" onChange={e=>{if(acceptsNumberInput(e.target.value,false)){setLow(e.target.value);setRangeChanged(true);}}}/></label><label>{pl?"Górna granica":"Upper limit"}<input maxLength={45} value={high} inputMode="decimal" onChange={e=>{if(acceptsNumberInput(e.target.value,false)){setHigh(e.target.value);setRangeChanged(true);}}}/></label></div>}</div>
   <div className={`edit-range-status edit-range-status--${status}`}><IconAlertTriangle size={18} aria-hidden="true"/><strong>{labels[status]}{deviation}</strong><span>{status==="above"||status==="below"?(pl?"Poza zakresem":"Outside range"):status==="within"?(pl?"W zakresie":"Within range"):(pl?"Brak danych":"No comparison")}</span></div>
   <label>{pl?"Notatka do wyniku / zalecenie lekarza":"Result note / veterinarian recommendation"}<textarea rows={2} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} placeholder={pl?"Wpisz notatkę lub zalecenie otrzymane od lekarza…":"Enter a note or advice received from your veterinarian…"}/></label>
   <label className="edit-key"><input type="checkbox" checked={key} onChange={e=>setKey(e.target.checked)}/>{pl?"Oznacz jako kluczowy parametr na pulpicie zdrowia pupila":"Mark as a key parameter on the pet’s health dashboard"}</label>
   {error&&<p role="alert" className="medical-error">{error}</p>}
  </fieldset><footer><button type="button" className="edit-restore" disabled={saving} onClick={restore}><IconRestore size={15}/><span>{pl?"Przywróć pierwotny odczyt":"Restore original reading"} ({original.value} {original.unit})</span></button><div><button type="button" disabled={saving} onClick={onCancel}>{pl?"Anuluj":"Cancel"}</button><button type="submit" disabled={saving}><IconDeviceFloppy size={15}/>{saving?(pl?"Zapisywanie…":"Saving…"):(pl?"Zapisz zmiany":"Save changes")}</button></div></footer></form>
 </dialog>;
}
