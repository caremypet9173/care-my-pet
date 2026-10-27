"use client";
import {useId} from 'react';
import {useLocale} from 'next-intl';
import {IconSearch,IconPlus} from '@tabler/icons-react';
import {ButtonLink} from '@/components/ui/button';
import type {MedicalReport} from './types';

export function ReportList({reports,petId,query,onQuery,onOpen}:{reports:MedicalReport[];petId:string;query:string;onQuery:(value:string)=>void;onOpen:(report:MedicalReport)=>void}){
 const locale=useLocale(),pl=locale==='pl',id=useId();
 const normalize=(s:string)=>s.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l');
 const filtered=reports.filter(r=>normalize(`${r.title} ${r.laboratory} ${r.doctor} ${r.test_date}`).includes(normalize(query.trim())));
 return <section className="pet-panel medical-report-list">
  <header><h2>{pl?'Lista badań':'Reports'}</h2><ButtonLink href={`/app/zwierzeta/${petId}/badania/nowe`} variant="secondary"><IconPlus size={18} aria-hidden="true"/>{pl?'Dodaj badanie':'Add report'}</ButtonLink></header>
  <label htmlFor={id}>{pl?'Szukaj badania po nazwie, laboratorium lub dacie':'Search by report name, laboratory or date'}</label>
  <input id={id} type="search" value={query} onChange={e=>onQuery(e.target.value)} placeholder={pl?'Np. morfologia, TK, USG lub 2026-10':'E.g. blood count, CT, ultrasound or 2026-10'}/>
  <p role="status">{pl?'Liczba badań':'Reports'}: {filtered.length}</p>
  {!filtered.length?(reports.length?<p>{pl?'Brak pasujących badań. Zmień wyszukiwanie.':'No matching reports. Try another search.'}</p>:<div><h3>{pl?'Nie ma jeszcze badań':'No reports yet'}</h3><p>{pl?'Dodaj pierwszy dokument.':'Add your first document.'}</p></div>):<ul>{filtered.map(r=><li key={r.id}>
   <time dateTime={r.test_date}>{new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(r.test_date))}</time>
   <div><h3><button type="button" onClick={()=>onOpen(r)}>{r.title}</button></h3><p>{r.laboratory||r.doctor||(pl?'Nie podano laboratorium':'Laboratory not specified')}</p><p>{r.rows.length>0?`${pl?'Liczba parametrów':'Parameters'}: ${r.rows.length}`:(pl?'Badanie opisowe / obrazowe':'Descriptive / imaging report')}</p></div>
   <button id={`open-report-${r.id}`} type="button" className="report-open" onClick={()=>onOpen(r)} aria-label={`${pl?'Otwórz badanie':'Open report'}: ${r.title}, ${r.test_date}`}><IconSearch size={18} aria-hidden="true"/>{pl?'Otwórz badanie':'Open report'}</button>
  </li>)}</ul>}
  {reports.length>=100&&<p>{pl?'Pokazano 100 najnowszych badań oraz badanie otwarte z odnośnika.':'Showing the latest 100 reports and any report opened by direct link.'}</p>}
 </section>;
}
