"use client";
import {useState,useId} from "react";
import {useLocale} from "next-intl";
import {IconPencil,IconTrash,IconCheck,IconCircle} from "@tabler/icons-react";
import {medicalMessages} from "./messages";
import {numeric,rangeStatus} from "./comparison";
import {acceptsNumberInput} from "./number-input";
import {measurementValueType,validMeasurementValue} from "../../../supabase/functions/medical-reports/value-type.mjs";
import type {Measurement} from "./types";

export function ReviewParameter({row,index,checked,submitted=false,onChange,onCheck,onRemove}:{
  row:Measurement;index:number;checked:boolean;submitted?:boolean;
  onChange:(field:keyof Measurement,value:string)=>void;onCheck:(value:boolean)=>void;onRemove:()=>void;
}){
  const locale=useLocale();const t=medicalMessages[locale];const status=rangeStatus(row);
  const valueType=measurementValueType(row);
  const numericValue=valueType==="decimal";
  function changeValue(value:string){if(!numericValue||acceptsNumberInput(value))onChange("value",value);}
  const valueAlign=numeric(row.value)!==null?"right":"left";
  const attention=status==="above"||status==="below";
  const errorId=useId();
  const nameInvalid=submitted&&!row.name.trim();
  const valueInvalid=(submitted||!!row.value)&&!validMeasurementValue(row.value,valueType);
  const checkInvalid=submitted&&!checked;
  const [identity,setIdentity]=useState(!row.name);
  return <fieldset className={`medical-parameter medical-parameter--${attention?"attention":"compact"} is-expanded ${checked?"is-checked":""} ${nameInvalid||valueInvalid||checkInvalid?"has-validation-error":""}`}>
    <legend className="sr-only">{index+1}. {row.name||t.name}</legend>
    <div className="review-parameter-line">
      <div className="review-parameter-identity"><span className={`review-dot review-dot--${status}`} aria-hidden="true"/><div><strong>{row.name||t.name}</strong><small>{t[row.category]}</small></div></div>
      <span className={`medical-status medical-status--${status}`}>{status==="above"?"↑ ":status==="below"?"↓ ":""}{t[status]}</span>
      <div className="review-parameter-actions"><button type="button" className="review-icon-button" aria-label={`${t.remove} ${index+1}`} onClick={onRemove}><IconTrash size={16}/></button></div>
    </div>
      <button type="button" className="review-identity-toggle" aria-expanded={identity} onClick={()=>setIdentity(!identity)}>{locale==="pl"?"Nazwa i kategoria":"Name and category"}<IconPencil size={14}/></button>
      {(identity||nameInvalid)&&<div className="medical-fields"><label>{t.name} *<input id={`review-row-${index}-name`} required maxLength={100} value={row.name} aria-invalid={nameInvalid} aria-describedby={nameInvalid?`${errorId}-name`:undefined} onChange={event=>onChange("name",event.target.value)}/></label><label>{t.report}<select value={row.category} onChange={event=>onChange("category",event.target.value)}>{(["blood","renal","liver","other"] as const).map(category=><option key={category} value={category}>{t[category]}</option>)}</select></label></div>}
      <div className="medical-row-values">{([['value',t.value,60],['unit',t.unit,40],['reference',t.reference,100]] as const).map(([key,label,max])=><label key={key}>{label}{key==="value"&&" *"}<input id={`review-row-${index}-${key}`} required={key==="value"} style={key==="value"?{textAlign:valueAlign}:undefined} maxLength={max} value={row[key]} inputMode={key==="value"&&numericValue?"decimal":undefined} aria-invalid={key==="value"&&valueInvalid} aria-describedby={key==="value"&&valueInvalid?`${errorId}-value`:undefined} onChange={event=>key==="value"?changeValue(event.target.value):onChange(key,event.target.value)}/></label>)}</div>
    {nameInvalid&&<p className="review-field-error" id={`${errorId}-name`}>{locale==="pl"?"Uzupełnij nazwę parametru.":"Enter the parameter name."}</p>}
    {valueInvalid&&<p className="review-field-error" id={`${errorId}-value`}>{locale==="pl"?(numericValue?"Wpisz poprawny wynik liczbowy.":"Uzupełnij wynik."):"Enter a valid result."}</p>}
    {checkInvalid&&<p className="review-field-error" id={`${errorId}-check`}>{locale==="pl"?"Porównaj parametr z oryginałem i zaznacz potwierdzenie.":"Check this parameter against the original and tick the confirmation."}</p>}
    <small className="review-value-type">{locale==="pl"?"Typ wartości: ":"Value type: "}{numericValue?(locale==="pl"?"liczba dziesiętna":"decimal number"):(locale==="pl"?"tekst / wynik opisowy":"text / descriptive result")}</small>
    <div className="medical-row-check"><label className="review-confirm-toggle"><input aria-label={t.confirmRow} id={`review-row-${index}-check`} type="checkbox" aria-invalid={checkInvalid} aria-describedby={checkInvalid?`${errorId}-check`:undefined} checked={checked} onChange={event=>onCheck(event.target.checked)}/>{checked?<IconCheck size={20} aria-hidden="true"/>:<IconCircle size={20} aria-hidden="true"/>}<span>{checked?t.confirmRow:(locale==="pl"?"Potwierdź zgodność z oryginałem":"Confirm match with original")}</span></label>{attention&&<small>{locale==="pl"?"Porównaj wartość i jednostkę z oryginałem.":"Compare the value and unit with the original."}</small>}</div>
  </fieldset>;
}
