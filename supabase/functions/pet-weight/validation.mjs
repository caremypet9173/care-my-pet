export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function validateWeight(input){
 const errors={};const value=typeof input?.kg==='string'?input.kg.trim():'';
 if(!/^\d{1,5}([.,]\d{1,3})?$/.test(value)||Number(value.replace(',','.'))<=0)errors.kg='invalid_weight';
 const date=input?.measured_on;
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<'1900-01-01'||date>today()||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)errors.measured_on='invalid_date';
 if(typeof input?.note!=='string'||input.note.length>200)errors.note='invalid_note';
 return {errors,value:Object.keys(errors).length?null:{kg:value.replace(',','.'),measured_on:date,note:input.note.trim()}};
}
