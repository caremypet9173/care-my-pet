"use client";
import { useRef, useState, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { IconList, IconHistory, IconFlask, IconFiles, IconScale, IconSparkles } from "@tabler/icons-react";
import { dashboardMessages } from "./dashboard-messages";
export function RecordSections({ children, history, results, weight, documents, assistant, initialTab = 0 }: { children: ReactNode; history?: ReactNode; results?: ReactNode; weight?: ReactNode; documents?: ReactNode; assistant?: ReactNode; initialTab?: number }) {
  const locale=useLocale(); const d = dashboardMessages[locale];
  const [selected, setSelected] = useState(initialTab);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const tabs = [
    { id:0, label: d.summary, icon: IconList, text: "" },
    { id:1, label: d.history, icon: IconHistory, text: d.noEvents },
    { id:2, label: d.results, icon: IconFlask, text: d.noResults },
    { id:3, label: d.documents, icon: IconFiles, text: d.noDocuments },
    { id:5, label: locale === "pl" ? "Asystent AI" : "AI Assistant", icon: IconSparkles, text: "" },
  ];
  tabs.splice(1,0,{id:4,label:locale==="pl"?"Waga i rozwój":"Weight and growth",icon:IconScale,text:""});
  return <><div className="household-record-tabs" role="tablist" aria-label={d.record} onKeyDown={event => {
    const position=tabs.findIndex(tab=>tab.id===selected);
    const next = event.key === "ArrowRight" ? (position + 1) % tabs.length : event.key === "ArrowLeft" ? (position + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
    if (next !== null) { event.preventDefault(); setSelected(tabs[next].id); refs.current[tabs[next].id]?.focus(); }
  }}>{tabs.map(({ label, icon: Icon, id:index }) => <button key={label} ref={node => { refs.current[index] = node; }} type="button" role="tab" id={`record-tab-${index}`} aria-controls={`record-panel-${index}`} aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)}><Icon size={18} aria-hidden="true" />{label}</button>)}</div>
    {tabs.map((tab) => <div key={tab.label} role="tabpanel" id={`record-panel-${tab.id}`} aria-labelledby={`record-tab-${tab.id}`} hidden={selected !== tab.id} tabIndex={0}>{tab.id === 0 ? children : tab.id === 1 && history ? history : tab.id === 4 && weight ? weight : tab.id === 2 && results ? results : tab.id === 3 && documents ? documents : tab.id === 5 && assistant ? assistant : <section className="pet-panel household-record-empty"><tab.icon size={32} aria-hidden="true" /><h2>{tab.label}</h2><p>{tab.text}</p><span className="household-tag">{d.upcoming}</span></section>}</div>)}
  </>;
}
