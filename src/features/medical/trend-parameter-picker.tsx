"use client";

import {useEffect, useId, useRef, useState} from 'react';
import {useLocale} from 'next-intl';
import {IconSearch, IconChevronDown, IconCheck} from '@tabler/icons-react';
import {medicalMessages} from './messages';
import type {Measurement} from './types';

const categories = ['blood','renal','liver','other'] as const;
const normalize = (text: string) => text.toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').toLocaleLowerCase();
const label = (row: Measurement) => `${row.name}${row.unit ? ` (${row.unit})` : ''}`;

export function TrendParameterPicker({rows,selected,onSelect}:{rows:Measurement[];selected:Measurement|null;onSelect:(row:Measurement)=>void}) {
 const locale=useLocale(), pl=locale==='pl', t=medicalMessages[locale];
 const id=useId(), input=useRef<HTMLInputElement>(null);
 const [open,setOpen]=useState(false), [query,setQuery]=useState(''), [active,setActive]=useState(-1);
 const options=categories.flatMap(category=>rows.filter(row=>row.category===category&&normalize(`${row.name} ${row.unit} ${t[category]}`).includes(normalize(query.trim()))));
 useEffect(()=>{if(open&&active>=0)document.getElementById(`${id}-option-${active}`)?.scrollIntoView({block:'nearest'});},[active,open,id]);
 function choose(row:Measurement){setOpen(false);setQuery('');setActive(-1);onSelect(row);}
 function expand(){setQuery('');setActive(-1);setOpen(true);}
 return <div className="trend-picker" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null)){setOpen(false);setQuery('');setActive(-1);}}}>
  <label htmlFor={id}>{pl?'Parametr na wykresie':'Chart parameter'}</label>
  <div className="trend-picker-control"><IconSearch size={18} aria-hidden="true"/>
   <input ref={input} id={id} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={open} aria-controls={open?`${id}-list`:undefined} aria-activedescendant={open&&active>=0?`${id}-option-${active}`:undefined} disabled={!rows.length} value={open?query:selected?label(selected):''} placeholder={pl?'Wpisz nazwę parametru…':'Search parameters…'} onFocus={expand} onClick={()=>{if(!open)expand();}} onChange={event=>{setQuery(event.target.value);setActive(-1);setOpen(true);}} onKeyDown={event=>{
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
     event.preventDefault();if(!open){expand();return;}
     if(options.length)setActive(current=>event.key==='ArrowDown'?(current+1)%options.length:current<=0?options.length-1:current-1);
    }else if(event.key==='Enter'&&open){event.preventDefault();if(active>=0&&options[active])choose(options[active]);}
    else if(event.key==='Escape'&&open){event.preventDefault();setOpen(false);setQuery('');setActive(-1);}
    else if(event.key==='Tab'){setOpen(false);setQuery('');setActive(-1);}
   }}/><IconChevronDown size={18} aria-hidden="true"/>
  </div>
  {open&&<div className="trend-picker-popup">
   <div id={`${id}-list`} role="listbox" aria-label={pl?'Parametry badania':'Report parameters'}>
    {categories.map(category=>{const group=options.filter(row=>row.category===category);return group.length>0&&<div role="group" aria-labelledby={`${id}-${category}`} key={category}>
     <div className="trend-picker-group" id={`${id}-${category}`}>{t[category]} <span>({group.length})</span></div>
     {group.map(row=>{const index=options.indexOf(row),isSelected=selected===row||!!row.id&&row.id===selected?.id;return <div key={row.id??index} id={`${id}-option-${index}`} role="option" aria-selected={isSelected} className={`trend-picker-option ${index===active?'is-active':''}`} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(row)}><span>{label(row)}</span>{isSelected&&<IconCheck size={17} aria-hidden="true"/>}</div>;})}
    </div>;})}
   </div>
   {!options.length&&<p role="status">{pl?'Nie znaleziono parametru. Spróbuj innej nazwy.':'No matching parameter. Try another name.'}</p>}
  </div>}
 </div>;
}
