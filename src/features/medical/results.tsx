"use client";
import { Fragment, useId, useRef, useState } from "react";
import {useRouter} from "next/navigation";
import { useLocale } from "next-intl";
import { IconFileText, IconFlask, IconPlus, IconCalendar, IconShieldCheck, IconPencil, IconStar, IconChevronDown, IconSparkles } from "@tabler/icons-react";
import { Link } from "@/i18n/navigation";
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { medicalMessages } from "./messages";
import { numeric, rangeStatus, sameParameter } from "./comparison";
import type { MedicalReport, Measurement, MeasurementCorrection } from "./types";
import {TrendParameterPicker} from "./trend-parameter-picker";
import { DischargeImportButton } from "./discharge-import-button";
import { LabComparisonMatrix } from "./lab-comparison-matrix";
import { PdfPreview } from "./pdf-preview";
import {EditParameterDialog} from "./edit-parameter-dialog";
import { FormattedMedicalText } from "./formatted-text";
import "@/styles/medical-edit-dialog.css";
export function MedicalResults({
  petId,
  householdId,
  petName,
  reports: initialReports,
  initialReportId,
  readOnly = false,
}: {
  petId: string;
  householdId?: string;
  petName?: string;
  reports: MedicalReport[];
  initialReportId?: string;
  readOnly?: boolean;
}) {
  const router=useRouter();
  const [detail,setDetail]=useState(!!initialReportId);
  const detailHeading=useRef<HTMLHeadingElement>(null);
  const backToList=useRef<HTMLButtonElement>(null);
  const origin=useRef<string|null>(null);
  const trend=useRef<HTMLElement>(null);
  const groupId=useId();
  const [collapsed,setCollapsed]=useState<Record<string,boolean>>({});
  function showTrend(row:Measurement){
    setParameter(row);
    requestAnimationFrame(()=>{
      trend.current?.focus({preventScroll:true});
      trend.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
    });
  }
  const [prevInitialReports,setPrevInitialReports]=useState(initialReports);
  const [reports,setReports]=useState(initialReports);
  if(initialReports!==prevInitialReports){setPrevInitialReports(initialReports);setReports(initialReports);}
  const [editing,setEditing]=useState<Measurement|null>(null);
  const locale=useLocale();const t=medicalMessages[locale];
  const [selected,setSelected]=useState(initialReportId??reports[0]?.id??"");const [filter,setFilter]=useState("all");
  const initialReport=reports.find(r=>r.id===initialReportId)??reports[0];
  const initialParameter=initialReport?.rows.find(row=>["above","below"].includes(rangeStatus(row)))??initialReport?.rows.find(row=>numeric(row.value)!==null)??null;
  const [parameter,setParameter]=useState<Measurement|null>(initialParameter);const [source,setSource]=useState<{id:string;url:string}|null>(null);
  const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  const report=reports.find(r=>r.id===selected)??reports[0];
  const date=(value:string)=>new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeZone:"UTC"}).format(new Date(value));
  async function openSource(){
    if(!report)return;setLoading(true);setError("");
    try{const {data,error}=await createClient().storage.from("medical-documents").createSignedUrl(report.source_path,900);if(error||!data)throw error;setSource({id:report.id,url:data.signedUrl});}catch{setError(t.loadError);}finally{setLoading(false);}
  }
  const points=parameter?reports.map(r=>{
    const matches=r.rows.filter(row=>sameParameter(row,parameter));const value=matches.length===1?numeric(matches[0].value):null;
    return {reportId:r.id,date:r.test_date,value,status:matches.length===1?rangeStatus(matches[0]):"unknown"};
  }).filter((point):point is {reportId:string;date:string;value:number;status:ReturnType<typeof rangeStatus>}=>point.value!==null).sort((a,b)=>a.date.localeCompare(b.date)):[];
  // Same-day duplicates and qualifiers are not combined into a misleading trend.
  const uniquePoints=points.filter(p=>points.filter(other=>other.date===p.date).length===1).slice(-12);
  const rows=report?.rows.filter(row=>filter==="all"||row.category===filter)??[];
  const openReportDetail=async (next:MedicalReport)=>{
    origin.current=next.id;setSelected(next.id);setCollapsed({});setFilter('all');setSource(null);
    let activeReport = next;
    if (next.rows.length === 0) {
      try {
        const client = createClient();
        const { data: rowsData } = await client
          .from("pomiar_parametru")
          .select("*, correction:measurement_correction(*)")
          .eq("wynik_id", next.id)
          .order("ordinal", { ascending: true });
        if (rowsData && rowsData.length > 0) {
          const mappedRows: Measurement[] = (
            rowsData as unknown as Array<
              Measurement & {
                correction?: MeasurementCorrection | null;
              }
            >
          ).map(({ correction, ...row }) => ({
            ...row,
            original: { value: row.value, unit: row.unit, reference: row.reference },
            ...(correction
              ? {
                  value: correction.value,
                  unit: correction.unit,
                  reference: correction.reference,
                  note: correction.note,
                  is_key: correction.is_key,
                  revision: correction.revision,
                }
              : { revision: 0 }),
          }));
          activeReport = { ...next, rows: mappedRows };
          setReports((prev) => prev.map((r) => (r.id === next.id ? activeReport : r)));
        }
      } catch (err) {
        console.error("Failed to load report parameters:", err);
      }
    }
    setParameter(activeReport.rows.find(row=>['above','below'].includes(rangeStatus(row)))??activeReport.rows.find(row=>numeric(row.value)!==null)??null);
    setDetail(true);requestAnimationFrame(()=>{detailHeading.current?.focus({preventScroll:true});backToList.current?.scrollIntoView({block:'start',behavior:'instant'});});
  };
  const labReports=reports.filter(r=>r.rows.length>0);
  const descriptiveReports=reports.filter(r=>r.rows.length===0);
  if(!detail)return <div className="medical-results">
    <section className="pet-panel medical-results-actions-bar">
      <div className="medical-results-actions-info">
        <h2>{locale==="pl"?"Wyniki laboratoryjne":"Laboratory results"}</h2>
        {descriptiveReports.length>0&&(
          <Link className="medical-descriptive-link" href={`/app/pets/${petId}?tab=history&filter=descriptive`}>
            <IconFileText size={15} aria-hidden="true"/>
            <span>
              {locale==="pl"
                ?`Badania opisowe / USG (${descriptiveReports.length}) w Historii →`
                :`Imaging / descriptive reports (${descriptiveReports.length}) in History →`}
            </span>
          </Link>
        )}
      </div>
      {!readOnly && (
        <div className="medical-results-actions-buttons">
          <DischargeImportButton
            pet={{ id: petId, imie: petName || "", gospodarstwo_id: householdId }}
            householdId={householdId}
          />
          <ButtonLink href={`/app/pets/${petId}/results/new`} variant="secondary" size="sm">
            <IconPlus size={16} aria-hidden="true"/>
            {locale==="pl"?"Dodaj badanie":"Add report"}
          </ButtonLink>
        </div>
      )}
    </section>
    {labReports.length>0 ? (
      <LabComparisonMatrix reports={reports} onOpenReport={openReportDetail}/>
    ) : descriptiveReports.length>0 ? (
      <section className="pet-panel medical-empty">
        <IconFlask size={36} aria-hidden="true"/>
        <h3>{locale==="pl"?"Brak badań laboratoryjnych z parametrami do porównania":"No numeric lab results to compare"}</h3>
        <p>{locale==="pl"?`Ten pupil ma wyłącznie badania opisowe lub obrazowe (${descriptiveReports.length}). Zobaczysz je chronologicznie w zakładce Historia.`:`This pet currently has only imaging or descriptive reports (${descriptiveReports.length}). View them chronologically in the History tab.`}</p>
        <div className="medical-empty-actions">
          <ButtonLink href={`/app/pets/${petId}?tab=history&filter=descriptive`} variant="secondary">
            {locale==="pl"?"Zobacz badania opisowe w Historii →":"View descriptive reports in History →"}
          </ButtonLink>
          {!readOnly && (
            <ButtonLink href={`/app/pets/${petId}/results/new`}>
              <IconPlus size={16} aria-hidden="true"/>
              {locale==="pl"?"Dodaj badanie":"Add report"}
            </ButtonLink>
          )}
        </div>
      </section>
    ) : (
      <section className="pet-panel medical-empty">
        <IconFileText size={36} aria-hidden="true"/>
        <h3>{t.empty}</h3>
        <p>{t.emptyHint}</p>
      </section>
    )}
  </div>;
  return <div className="medical-results">
    <div className="medical-detail-nav">
      <button ref={backToList} className="medical-back-list" type="button" onClick={()=>{setDetail(false);requestAnimationFrame(()=>document.getElementById(`open-report-${origin.current??selected}`)?.focus());}}>{locale==="pl"?"← Wróć do porównania wyników":"← Back to results comparison"}</button>
      {report&&report.rows.length===0&&(
        <Link className="medical-back-history" href={`/app/pets/${petId}?tab=history&filter=descriptive`}>
          <IconFileText size={15} aria-hidden="true"/>
          <span>{locale==="pl"?"← Badania opisowe w Historii":"← Descriptive reports in History"}</span>
        </Link>
      )}
    </div>
    <h2 ref={detailHeading} tabIndex={-1} className="medical-detail-title">{locale==="pl"?"Szczegóły badania":"Report details"}</h2>
    <section className="pet-panel medical-results-heading"><div className="medical-results-title"><h2>{t.heading}</h2><p>{t.intro}</p></div><div className="medical-report-controls">{report&&<><label className="medical-report-picker"><IconCalendar size={18} aria-hidden="true"/><span className="sr-only">{t.report}</span><select aria-label={t.report} value={report.id} onChange={event=>{const next=reports.find(r=>r.id===event.target.value);setSelected(event.target.value);setCollapsed({});setParameter(next?.rows.find(row=>["above","below"].includes(rangeStatus(row)))??next?.rows.find(row=>numeric(row.value)!==null)??null);setSource(null);}}>{reports.map(r=><option key={r.id} value={r.id}>{date(r.test_date)} · {r.laboratory||r.title} ({r.rows.length>0?r.rows.length:locale==="pl"?"opisowe":"descriptive"})</option>)}</select>{report.rows.some(row=>["above","below"].includes(rangeStatus(row)))&&<span className="medical-status medical-status--above">{locale==="pl"?"Odchylenia":"Outside range"}</span>}</label><button className="medical-source-link" type="button" onClick={openSource} disabled={loading}><IconFileText size={16}/>{t.source}</button><Link className="medical-ask-assistant-btn" href={`/app/pets/${petId}?tab=assistant&prompt=${encodeURIComponent(locale==="pl"?`Co wynika z badania "${report.title}" z dnia ${report.test_date}? Zwróć uwagę na odchylenia parametrów i zalecenia.`:`What are the key findings from the report "${report.title}" dated ${report.test_date}? Highlight any abnormal values and recommendations.`)}`}><IconSparkles size={15} aria-hidden="true"/><span>{locale==="pl"?"Zapytaj Asystenta":"Ask Assistant"}</span></Link></>}{!readOnly&&<ButtonLink size="sm" variant="secondary" href={`/app/pets/${petId}/results/new`}><IconPlus size={16}/>{t.add}</ButtonLink>}</div>
      {report&&report.rows.length>0&&<div className="medical-filters" aria-label={t.table}>{(["all","renal","blood","liver","other"] as const).map(value=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>{setFilter(value);if(value!=="all")setCollapsed(current=>({...current,[value]:false}));}}>{t[value]} ({value==="all"?report.rows.length:report.rows.filter(row=>row.category===value).length})</button>)}</div>}
    </section>
    {!report?<section className="pet-panel medical-empty"><IconFileText size={36} aria-hidden="true"/><h3>{t.empty}</h3><p>{t.emptyHint}</p></section>:<>
      {report.rows.length>0&&<section ref={trend} tabIndex={-1} aria-labelledby={`${groupId}-trend-title`} className="pet-panel medical-trend"><div className="medical-trend-heading"><div><h3 id={`${groupId}-trend-title`}>{t.trend}{parameter?`: ${parameter.name} (${parameter.unit})`:""}</h3><p>{t.trendHint}</p></div><TrendParameterPicker key={report.id} rows={report.rows} selected={parameter} onSelect={setParameter}/></div>
        {uniquePoints.length>=2?<Trend points={uniquePoints} label={`${parameter?.name} (${parameter?.unit})`} onOpen={id=>{
          const next=reports.find(item=>item.id===id);if(!next||!parameter)return;
          setSelected(id);setParameter(next.rows.find(row=>sameParameter(row,parameter))??null);setCollapsed({});setFilter('all');setSource(null);
          requestAnimationFrame(()=>{detailHeading.current?.focus({preventScroll:true});backToList.current?.scrollIntoView({block:'start',behavior:'instant'});});
        }}/>:<p className="medical-chart-empty">{t.noTrend}</p>}
      </section>}
      {Boolean(report.ai_interpretation?.trim())&&<section className="pet-panel medical-ai-card" aria-label={locale==="pl"?"Wstępna analiza AI badania":"Preliminary AI report analysis"}><header className="medical-ai-card-header"><div className="medical-ai-card-title"><IconSparkles size={20} className="medical-ai-sparkle-icon" aria-hidden="true"/><div><h3>{locale==="pl"?"Wstępna analiza AI badania":"Preliminary AI report analysis"}</h3><p>{locale==="pl"?"Wnioski i podsumowanie wygenerowane automatycznie na podstawie dokumentu":"Summary and key findings generated automatically from the document"}</p></div></div><span className="medical-ai-badge">AI Assistant</span></header><div className="medical-ai-card-content"><FormattedMedicalText text={report.ai_interpretation||""}/></div><footer className="medical-ai-card-footer"><small>{locale==="pl"?"Wstępna analiza AI ma charakter wyłącznie pomocniczy i nie zastępuje diagnozy lekarza weterynarii.":"Preliminary AI analysis is for informational purposes only and does not replace a veterinary diagnosis."}</small><div style={{marginTop:".5rem"}}><Link className="medical-ask-assistant-btn" href={`/app/pets/${petId}?tab=assistant&prompt=${encodeURIComponent(locale==="pl"?`Przeanalizuj badanie "${report.title}" (${report.test_date}) i wyjaśnij szczegółowo wnioski z analizy AI oraz dalsze kroki.`:`Analyze the report "${report.title}" (${report.test_date}) and explain the AI findings and recommended next steps.`)}`}><IconSparkles size={14} aria-hidden="true"/><span>{locale==="pl"?"Porozmawiaj z Asystentem o tych wynikach →":"Discuss this report with Assistant →"}</span></Link></div></footer></section>}
      <section className="pet-panel medical-table-panel"><header><div><h3>{report.rows.length>0?t.table:(locale==="pl"?"Opis badania obrazowego / specjalistycznego":"Imaging / descriptive report findings")}</h3><p>{report.title}{report.laboratory?` · ${report.laboratory}`:""}{report.doctor?` · ${report.doctor}`:""}</p></div><span className="medical-report-date">{locale==="pl"?"Data wykonania: ":"Test date: "}{date(report.test_date)}</span></header>
        {report.rows.length===0?(!report.notes&&<p className="medical-descriptive-empty">{t.noRows}</p>):!rows.length?<p>{t.noMatches}</p>:<div className="medical-table-scroll"><table><thead><tr>{[t.name,locale==="pl"?"Aktualny wynik":"Current result",locale==="pl"?"Poprzednio":t.previous,locale==="pl"?"Zakres referencyjny / rozkład":"Reference range / distribution",locale==="pl"?"Status":t.status].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead>{(["blood","renal","liver","other"] as const).map(category=>{
          const grouped=rows.filter(row=>row.category===category);if(!grouped.length)return null;
          const open=!collapsed[category];
          return <Fragment key={category}><tbody className="medical-group-heading"><tr><th colSpan={5} scope="rowgroup"><button type="button" aria-expanded={open} aria-controls={`${groupId}-${category}`} onClick={()=>setCollapsed(current=>({...current,[category]:!current[category]}))}><IconChevronDown size={18} aria-hidden="true"/><span>{t[category]}</span><span className="medical-group-count">{grouped.length}</span><span className="medical-group-action">{locale==="pl"?(open?"Zwiń":"Rozwiń"):(open?"Collapse":"Expand")}</span></button></th></tr></tbody><tbody id={`${groupId}-${category}`} hidden={!open}>{grouped.map((row,index)=>{
          const previous=reports.filter(r=>r.test_date<report.test_date).flatMap(r=>{const values=r.rows.filter(v=>sameParameter(v,row));return values.length===1?[{date:r.test_date,row:values[0]}]:[];})[0];
          const status=rangeStatus(row);
          const currentValue=numeric(row.value),previousValue=previous?numeric(previous.row.value):null;
          const delta=currentValue!==null&&previousValue!==null?currentValue-previousValue:null;
          const change=delta===null?null:new Intl.NumberFormat(locale,{maximumSignificantDigits:12,signDisplay:"exceptZero"}).format(delta);
          return <tr key={index} className={status==="above"||status==="below"?"medical-result-attention":undefined}><th scope="row"><div className="medical-table-identity"><button type="button" className="medical-param-link" onClick={()=>showTrend(row)}>{row.name}{row.is_key&&<IconStar size={13} aria-label={locale==="pl"?"Kluczowy parametr":"Key parameter"}/>}</button><span className={`medical-category medical-category--${row.category}`}>{t[row.category]}</span></div></th><td className="medical-current-result"><strong>{row.value}</strong> <span>{row.unit}</span></td><td>{previous?<><div className="medical-previous-result"><span>{previous.row.value} {previous.row.unit}</span>{change!==null&&<span className="medical-result-delta">{delta!>0?"↑ ":delta!<0?"↓ ":""}({change})</span>}</div><small>{date(previous.date)}</small></>:"—"}</td><td><ReferenceRange row={row}/></td><td><span className={`medical-status medical-status--${status}`}><span aria-hidden="true">{status==="above"?"↑ ":status==="below"?"↓ ":status==="within"?"● ":""}</span>{t[status]}</span>{!readOnly&&row.id&&<button type="button" className="medical-row-edit" onClick={()=>setEditing(row)}><IconPencil size={14}/>{locale==="pl"?"Edytuj":"Edit"}</button>}</td></tr>;
        })}</tbody></Fragment>;})}</table></div>}
        {report.notes&&<FormattedMedicalText text={report.notes} className={`medical-notes${report.rows.length===0?" is-descriptive":""}`}/>}
      </section>
      <aside className="medical-results-disclaimer"><IconShieldCheck size={22} aria-hidden="true"/><p>{t.rangeHint}</p></aside>
      {source?.id===report.id&&<section className="pet-panel medical-saved-source"><header><h3>{report.source_name}</h3><a href={source.url} target="_blank" rel="noopener noreferrer">{t.open}</a></header>{report.source_mime==="application/pdf"?<PdfPreview key={source.url} url={source.url}/>:
        // Private signed URL must not pass through the image optimization cache.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={source.url} alt={t.original}/>}</section>}
      {reports.length>=100&&<p>{t.latest100}</p>}
    </>}{editing&&report&&<EditParameterDialog row={editing} report={report} petId={petId} onCancel={()=>setEditing(null)} onSave={correction=>{setReports(previous=>previous.map(item=>item.id===report.id?{...item,rows:item.rows.map(row=>row.id===editing.id?{...row,...correction}:row)}:item));if(parameter?.id===editing.id)setParameter({...editing,...correction});setEditing(null);router.refresh();}}/>}{error&&<p role="alert" className="medical-error">{error}</p>}
  </div>;
}
function ReferenceRange({row}:{row:Measurement}){
  const match=row.reference.trim().match(/^(-?\d+(?:[.,]\d+)?)\s*[-–—]\s*(-?\d+(?:[.,]\d+)?)$/);
  const value=numeric(row.value);
  if(!match||value===null)return <span>{row.reference||"—"}</span>;
  const low=numeric(match[1])!,high=numeric(match[2])!;
  if(low>=high)return <span>{row.reference}</span>;
  // The central 70% is the supplied reference interval; the marker uses the same scale.
  const position=Math.max(2,Math.min(98,15+(value-low)/(high-low)*70));
  return <div className="medical-reference-range"><div className="medical-range-labels"><span>{match[1]} {row.unit}</span><span>{match[2]} {row.unit}</span></div><div className="medical-range-track" aria-hidden="true"><span className="medical-range-normal"/><span className={`medical-range-marker medical-range-marker--${rangeStatus(row)}`} style={{left:`${position}%`}}/></div></div>;
}
function Trend({points,label,onOpen}:{points:{reportId:string;date:string;value:number;status:ReturnType<typeof rangeStatus>}[];label:string;onOpen:(id:string)=>void}){
  const gradient=useId();
  const locale=useLocale();const format=(n:number)=>new Intl.NumberFormat(locale,{maximumFractionDigits:4}).format(n);
  const low=Math.min(...points.map(p=>p.value)),high=Math.max(...points.map(p=>p.value));
  const span=high-low||Math.max(Math.abs(high)*.1,1);const first=Date.parse(points[0].date),last=Date.parse(points.at(-1)!.date);
  const positions=points.map(p=>({...p,x:40+(Date.parse(p.date)-first)/(last-first)*640,y:150-(p.value-low)/span*100}));
  const line=positions.map((p,i)=>`${i?'L':'M'}${p.x},${p.y}`).join(' ');
  return <figure><svg viewBox="0 0 720 200" role="group" aria-label={`${label}: ${points.map(p=>`${p.date}: ${format(p.value)}`).join('; ')}`}>
    <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ba7517" stopOpacity=".2"/><stop offset="100%" stopColor="#1d7a4f" stopOpacity=".02"/></linearGradient></defs>
    {[0,.5,1].map(fraction=><g key={fraction}><line x1="40" x2="680" y1={150-fraction*100} y2={150-fraction*100} stroke="#e7e5e4" strokeDasharray="4 4"/><text x="32" y={154-fraction*100} textAnchor="end" fontSize="10" fill="#78716c">{format(low+fraction*span)}</text></g>)}
    <path d={`${line} L680,155 L40,155 Z`} fill={`url(#${gradient})`}/><path d={line} fill="none" stroke="#164d34" strokeWidth="3" strokeLinecap="round"/>
    {positions.map((p,index)=>{const attention=index===positions.length-1&&["above","below"].includes(p.status);return <g key={p.date}><g role="button" tabIndex={0} className="medical-trend-point" aria-label={`${locale==='pl'?'Otwórz badanie':'Open report'}: ${p.date}, ${label}: ${format(p.value)}`} onClick={()=>onOpen(p.reportId)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onOpen(p.reportId);}}}><circle className="medical-trend-hit" cx={p.x} cy={p.y} r={28} fill="transparent"/><circle cx={p.x} cy={p.y} r={attention?7:5} fill={attention?"#ba7517":"#10b981"} stroke="white" strokeWidth="2"/><title>{`${p.date}: ${format(p.value)}`}</title></g>{(positions.length<=6||index===0||index===positions.length-1)&&<><text x={p.x} y={p.y-14} textAnchor="middle" fontSize="11" fontWeight="700" fill={attention?"#6a4b1a":"#164d34"}>{format(p.value)}</text><text x={p.x} y="180" textAnchor="middle" fontSize="10" fill="#566b60">{new Intl.DateTimeFormat(locale,{month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(p.date))}</text></>}</g>;})}
  </svg><figcaption>{label} · {locale==='pl'?'Kliknij punkt, aby otworzyć badanie.':'Select a point to open its report.'}</figcaption></figure>;
}
