"use client";

import {useEffect, useRef} from 'react';
import {IconTrash, IconX} from '@tabler/icons-react';
import {useLocale} from 'next-intl';

type Props = {
 petName: string;
 weight: string;
 date: string;
 pending: boolean;
 error: string;
 onClose: () => void;
 onConfirm: () => void;
};

export function WeightDeleteDialog({petName, weight, date, pending, error, onClose, onConfirm}: Props) {
 const pl = useLocale() === 'pl';
 const dialog = useRef<HTMLDialogElement>(null);
 const cancel = useRef<HTMLButtonElement>(null);
 useEffect(() => {
  const element = dialog.current!;
  const previousFocus = document.activeElement as HTMLElement | null;
  const overflow = document.body.style.overflow;
  element.showModal();
  cancel.current?.focus();
  document.body.style.overflow = 'hidden';
  return () => {
   element.close();
   document.body.style.overflow = overflow;
   if (previousFocus?.isConnected) previousFocus.focus();
   else document.getElementById('record-panel-4')?.focus();
  };
 }, []);
 return <dialog ref={dialog} className="weight-dialog weight-delete-dialog" aria-labelledby="weight-delete-title" aria-describedby="weight-delete-description" onCancel={event => {event.preventDefault(); if (!pending) onClose();}}>
  <header>
   <span className="weight-dialog-icon"><IconTrash size={24} aria-hidden="true"/></span>
   <div><h2 id="weight-delete-title">{pl ? 'Usunąć pomiar wagi?' : 'Delete weight measurement?'}</h2><p>{petName}</p></div>
   <button type="button" disabled={pending} onClick={onClose} aria-label={pl ? 'Zamknij okno' : 'Close dialog'}><IconX size={20} aria-hidden="true"/></button>
  </header>
  <div className="weight-delete-content">
   <div className="weight-delete-summary"><strong>{weight} <span>kg</span></strong><span>{date}</span></div>
   <p id="weight-delete-description">{pl ? 'Pomiar zniknie z historii i wykresu wagi. Tej operacji nie można cofnąć.' : 'This measurement will be removed from the weight history and chart. This cannot be undone.'}</p>
   {error && <p className="weight-error" role="alert">{error}</p>}
  </div>
  <footer>
   <button ref={cancel} type="button" disabled={pending} onClick={onClose}>{pl ? 'Anuluj' : 'Cancel'}</button>
   <button className="weight-delete-confirm" type="button" disabled={pending} onClick={onConfirm}><IconTrash size={18} aria-hidden="true"/>{pending ? (pl ? 'Usuwanie…' : 'Deleting…') : (pl ? 'Usuń pomiar' : 'Delete measurement')}</button>
  </footer>
 </dialog>;
}
