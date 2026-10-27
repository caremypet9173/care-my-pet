"use client";

import {useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import {useLocale} from 'next-intl';
import {
  IconBuildingHospital,
  IconCalendarEvent,
  IconCheck,
  IconClock,
  IconFileText,
  IconFlask,
  IconHistory,
  IconPencil,
  IconPill,
  IconPlus,
  IconSearch,
  IconStethoscope,
  IconTrash,
  IconUser,
  IconVaccine,
  IconX,
} from '@tabler/icons-react';
import {Link} from '@/i18n/navigation';
import {Button} from '@/components/ui/button';
import {createClient} from '@/lib/supabase/client';
import {rangeStatus} from '@/features/medical/comparison';
import {FormattedMedicalText} from '@/features/medical/formatted-text';
import type {MedicalReport} from '@/features/medical/types';
import type {HealthEvent, HealthEventCategory} from './types';
import {HistoryDialog} from './history-dialog';
import {HistoryDeleteDialog} from './history-delete-dialog';

type FilterCategory = 'all' | 'visit' | 'vaccination' | 'lab' | 'prevention';

type TimelineItem =
  | {
      kind: 'manual';
      id: string;
      category: HealthEventCategory;
      date: string;
      createdAt: string;
      event: HealthEvent;
    }
  | {
      kind: 'lab';
      id: string;
      category: 'lab';
      date: string;
      createdAt: string;
      report: MedicalReport;
    };

export function HistoryPanel({
  petId,
  householdId,
  petName,
  initialEvents,
  reports,
}: {
  petId: string;
  householdId: string;
  petName: string;
  initialEvents: HealthEvent[];
  reports: MedicalReport[];
}) {
  const locale = useLocale();
  const pl = locale === 'pl';
  const router = useRouter();

  const [events, setEvents] = useState(initialEvents);
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HealthEvent | null>(null);
  const [deleting, setDeleting] = useState<HealthEvent | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const allItems = useMemo<TimelineItem[]>(() => {
    const manualItems: TimelineItem[] = events.map(ev => ({
      kind: 'manual',
      id: ev.id,
      category: ev.category,
      date: ev.event_date,
      createdAt: ev.created_at,
      event: ev,
    }));
    const labItems: TimelineItem[] = reports.map(rep => ({
      kind: 'lab',
      id: `lab-${rep.id}`,
      category: 'lab',
      date: rep.test_date,
      createdAt: rep.confirmed_at,
      report: rep,
    }));
    return [...manualItems, ...labItems].sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  }, [events, reports]);

  const counts = useMemo(() => {
    const map: Record<FilterCategory, number> = {
      all: allItems.length,
      visit: 0,
      vaccination: 0,
      lab: 0,
      prevention: 0,
    };
    for (const item of allItems) {
      map[item.category] += 1;
    }
    return map;
  }, [allItems]);

  const normalizedQuery = query.trim().toLocaleLowerCase(locale);

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (filter !== 'all' && item.category !== filter) return false;
      if (!normalizedQuery) return true;
      if (item.kind === 'manual') {
        const {
          title,
          clinic,
          doctor,
          batch_or_product,
          description,
          event_date,
          source_name,
        } = item.event;
        return [
          title,
          clinic,
          doctor,
          batch_or_product,
          description,
          event_date,
          source_name,
        ].some(val => val?.toLocaleLowerCase(locale).includes(normalizedQuery));
      }
      const {title, laboratory, doctor, notes, test_date, rows} = item.report;
      const paramNames = rows.map(r => r.name).join(' ');
      return [title, laboratory, doctor, notes, test_date, paramNames].some(val =>
        val?.toLocaleLowerCase(locale).includes(normalizedQuery),
      );
    });
  }, [allItems, filter, normalizedQuery, locale]);

  const groupedByMonth = useMemo(() => {
    const groups: {monthKey: string; monthLabel: string; items: TimelineItem[]}[] = [];
    const formatter = new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
    for (const item of filteredItems) {
      const monthKey = item.date.slice(0, 7);
      const existing = groups.find(g => g.monthKey === monthKey);
      if (existing) {
        existing.items.push(item);
      } else {
        const dateObj = new Date(`${monthKey}-01T00:00:00Z`);
        groups.push({
          monthKey,
          monthLabel: formatter.format(dateObj).toLocaleUpperCase(locale),
          items: [item],
        });
      }
    }
    return groups;
  }, [filteredItems, locale]);

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {dateStyle: 'medium', timeZone: 'UTC'}).format(new Date(iso));

  async function confirmDelete() {
    if (!deleting || deletePending) return;
    setDeletePending(true);
    setDeleteError('');
    try {
      const client = createClient();
      const {error} = await client.functions.invoke('pet-history', {
        body: {
          action: 'delete',
          id: deleting.id,
          pet_id: petId,
          revision: deleting.revision,
        },
      });
      if (error) {
        setDeleteError(
          error.context?.status === 409
            ? pl
              ? 'Wpis został zmieniony w innej karcie. Odśwież stronę.'
              : 'This entry changed elsewhere. Refresh the page.'
            : pl
              ? 'Nie udało się usunąć wpisu. Spróbuj ponownie.'
              : 'Could not delete entry. Please retry.',
        );
        return;
      }
      if (deleting.source_path) {
        await client.storage.from('medical-documents').remove([deleting.source_path]);
      }
      setEvents(prev => prev.filter(item => item.id !== deleting.id));
      setDeleting(null);
      router.refresh();
    } catch {
      setDeleteError(
        pl
          ? 'Nie udało się usunąć wpisu. Spróbuj ponownie.'
          : 'Could not delete entry. Please retry.',
      );
    } finally {
      setDeletePending(false);
    }
  }

  const filterButtons: {id: FilterCategory; label: string}[] = [
    {id: 'all', label: pl ? 'Wszystkie' : 'All'},
    {id: 'visit', label: pl ? 'Wizyty kontrolne' : 'Check-up visits'},
    {id: 'vaccination', label: pl ? 'Szczepienia' : 'Vaccinations'},
    {id: 'lab', label: pl ? 'Badania lab' : 'Lab reports'},
    {id: 'prevention', label: pl ? 'Leki i profilaktyka' : 'Meds & prevention'},
  ];

  const defaultDialogCategory: HealthEventCategory =
    filter === 'vaccination' || filter === 'prevention' || filter === 'visit' ? filter : 'visit';

  return (
    <div className="history-panel">
      <section className="pet-panel history-header-card">
        <div className="history-header-top">
          <div>
            <h2>{pl ? 'Oś czasu historii zdrowia' : 'Health history timeline'}</h2>
            <p className="history-subtitle">
              {pl
                ? 'Kompletny dziennik wizyt weterynaryjnych, szczepień, badań laboratoryjnych i profilaktyki.'
                : 'Complete log of veterinary visits, vaccinations, lab reports, and preventative care.'}
            </p>
          </div>
          <div className="history-header-actions">
            <div className="medical-report-search history-search">
              <IconSearch size={18} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={
                  pl
                    ? 'Szukaj wizyty, szczepienia, leku lub lekarza…'
                    : 'Search visit, vaccine, medication, or doctor…'
                }
                aria-label={pl ? 'Szukaj w historii zdrowia' : 'Search health history'}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label={pl ? 'Wyczyść wyszukiwanie' : 'Clear search'}
                >
                  <IconX size={16} aria-hidden="true" />
                </button>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <IconPlus size={16} aria-hidden="true" />
              {pl ? 'Dodaj wpis' : 'Add entry'}
            </Button>
          </div>
        </div>

        <div
          className="history-filter-pills"
          role="tablist"
          aria-label={pl ? 'Filtruj wpisy według kategorii' : 'Filter entries by category'}
        >
          {filterButtons.map(btn => {
            const active = filter === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`history-filter-pill${active ? ' is-active' : ''}`}
                onClick={() => setFilter(btn.id)}
              >
                <span>{btn.label}</span>
                <small>{counts[btn.id]}</small>
              </button>
            );
          })}
        </div>
      </section>

      {allItems.length === 0 ? (
        <section className="pet-panel medical-empty-state">
          <span className="medical-empty-icon">
            <IconHistory size={30} aria-hidden="true" />
          </span>
          <h2>{pl ? 'Brak wpisów w historii zdrowia' : 'No health history entries yet'}</h2>
          <p>
            {pl
              ? 'Dodaj pierwszą wizytę kontrolną, szczepienie lub preparat profilaktyczny, aby prowadzić uporządkowaną oś czasu zdrowia zwierzęcia.'
              : 'Add the first check-up visit, vaccination, or preventative treatment to build a complete health timeline.'}
          </p>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <IconPlus size={18} aria-hidden="true" />
            {pl ? 'Dodaj pierwszy wpis' : 'Add first entry'}
          </Button>
        </section>
      ) : filteredItems.length === 0 ? (
        <section className="pet-panel">
          <p className="medical-filter-empty">
            {pl
              ? 'Brak wpisów pasujących do wybranego filtru lub frazy wyszukiwania.'
              : 'No entries match the selected filter or search query.'}
          </p>
        </section>
      ) : (
        <div className="history-timeline">
          {groupedByMonth.map(group => (
            <section key={group.monthKey} className="history-month-group">
              <div className="history-month-badge">
                <span>{group.monthLabel}</span>
              </div>

              <ol className="history-timeline-list">
                {group.items.map(item => {
                  if (item.kind === 'manual') {
                    const ev = item.event;
                    const Icon =
                      ev.category === 'vaccination'
                        ? IconVaccine
                        : ev.category === 'prevention'
                          ? IconPill
                          : IconStethoscope;
                    const categoryLabel =
                      ev.category === 'vaccination'
                        ? pl
                          ? 'Szczepienie'
                          : 'Vaccination'
                        : ev.category === 'prevention'
                          ? pl
                            ? 'Leki i profilaktyka'
                            : 'Meds & prevention'
                          : pl
                            ? 'Wizyta kontrolna'
                            : 'Check-up visit';

                    const nextDuePrefix =
                      ev.category === 'vaccination'
                        ? pl
                          ? 'Ważne do:'
                          : 'Valid until:'
                        : ev.category === 'prevention'
                          ? pl
                            ? 'Następna dawka:'
                            : 'Next dose:'
                          : pl
                            ? 'Kolejna wizyta:'
                            : 'Next visit:';

                    return (
                      <li key={item.id} className={`history-timeline-item is-${ev.category}`}>
                        <span className={`history-node-icon is-${ev.category}`} aria-hidden="true">
                          <Icon size={20} />
                        </span>

                        <article className="pet-panel history-card">
                          <div className="history-card-top">
                            <div className="history-card-heading">
                              <div className="history-card-badges">
                                <span className={`history-category-tag is-${ev.category}`}>
                                  {categoryLabel}
                                </span>
                                <span className="history-date-tag">
                                  <IconCalendarEvent size={14} aria-hidden="true" />
                                  <time dateTime={ev.event_date}>{formatDate(ev.event_date)}</time>
                                </span>
                              </div>
                              <h3>{ev.title}</h3>
                            </div>

                            <div className="history-card-status">
                              {ev.next_due_date ? (
                                <span className="history-status-pill is-due">
                                  <IconClock size={14} aria-hidden="true" />
                                  {nextDuePrefix} {formatDate(ev.next_due_date)}
                                </span>
                              ) : (
                                <span className="history-status-pill is-done">
                                  <IconCheck size={14} aria-hidden="true" />
                                  {pl ? 'Zrealizowano' : 'Completed'}
                                </span>
                              )}
                            </div>
                          </div>

                          {(ev.doctor || ev.clinic) && (
                            <div className="history-card-meta">
                              {ev.doctor && (
                                <span>
                                  <IconUser size={15} aria-hidden="true" />
                                  {ev.doctor}
                                </span>
                              )}
                              {ev.clinic && (
                                <span>
                                  <IconBuildingHospital size={15} aria-hidden="true" />
                                  {ev.clinic}
                                </span>
                              )}
                            </div>
                          )}

                          {ev.description && (
                            <FormattedMedicalText
                              text={ev.description}
                              className="history-card-desc"
                            />
                          )}

                          <div className="history-card-footer">
                            <div className="history-card-tags">
                              {ev.batch_or_product && (
                                <span className="history-product-pill">{ev.batch_or_product}</span>
                              )}
                            </div>

                            <div className="history-card-actions">
                              {ev.source_path && (
                                <Link
                                  className="history-action-link is-primary"
                                  href={`/app/zwierzeta/${petId}?tab=documents&document=${ev.id}`}
                                >
                                  <IconFileText size={15} aria-hidden="true" />
                                  {pl ? 'Dokument źródłowy' : 'Source document'}
                                </Link>
                              )}
                              <button
                                type="button"
                                className="history-action-btn"
                                onClick={() => {
                                  setEditing(ev);
                                  setDialogOpen(true);
                                }}
                              >
                                <IconPencil size={15} aria-hidden="true" />
                                {pl ? 'Edytuj' : 'Edit'}
                              </button>
                              <button
                                type="button"
                                className="history-action-btn is-danger"
                                onClick={() => {
                                  setDeleteError('');
                                  setDeleting(ev);
                                }}
                              >
                                <IconTrash size={15} aria-hidden="true" />
                                {pl ? 'Usuń' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        </article>
                      </li>
                    );
                  }

                  const rep = item.report;
                  const isDescriptive = rep.rows.length === 0;
                  const abnormalRows = rep.rows.filter(r => {
                    const st = rangeStatus(r);
                    return st === 'above' || st === 'below';
                  });
                  const highlightedRows = (
                    abnormalRows.length > 0
                      ? abnormalRows
                      : rep.rows.filter(r => r.is_key).length > 0
                        ? rep.rows.filter(r => r.is_key)
                        : rep.rows
                  ).slice(0, 3);
                  const notePreview =
                    rep.notes && rep.notes.length > 520
                      ? `${rep.notes.slice(0, 520).trimEnd()}…`
                      : rep.notes;

                  return (
                    <li key={item.id} className="history-timeline-item is-lab">
                      <span className="history-node-icon is-lab" aria-hidden="true">
                        <IconFlask size={20} />
                      </span>

                      <article className="pet-panel history-card is-lab-card">
                        <div className="history-card-top">
                          <div className="history-card-heading">
                            <div className="history-card-badges">
                              <span className="history-category-tag is-lab">
                                {isDescriptive
                                  ? pl
                                    ? 'Badanie obrazowe / opisowe'
                                    : 'Imaging / descriptive report'
                                  : pl
                                    ? 'Badania laboratoryjne'
                                    : 'Lab report'}
                              </span>
                              <span className="history-date-tag">
                                <IconCalendarEvent size={14} aria-hidden="true" />
                                <time dateTime={rep.test_date}>{formatDate(rep.test_date)}</time>
                              </span>
                            </div>
                            <h3>{rep.title}</h3>
                          </div>

                          <div className="history-card-status">
                            {isDescriptive ? (
                              <span className="history-status-pill is-done">
                                <IconCheck size={14} aria-hidden="true" />
                                {pl ? 'Opis badania' : 'Descriptive report'}
                              </span>
                            ) : abnormalRows.length > 0 ? (
                              <span className="history-status-pill is-warning">
                                {pl
                                  ? `Do obserwacji (${abnormalRows.length})`
                                  : `Watch (${abnormalRows.length})`}
                              </span>
                            ) : (
                              <span className="history-status-pill is-done">
                                <IconCheck size={14} aria-hidden="true" />
                                {pl ? 'W normie' : 'Within range'}
                              </span>
                            )}
                          </div>
                        </div>

                        {(rep.doctor || rep.laboratory) && (
                          <div className="history-card-meta">
                            {rep.doctor && (
                              <span>
                                <IconUser size={15} aria-hidden="true" />
                                {rep.doctor}
                              </span>
                            )}
                            {rep.laboratory && (
                              <span>
                                <IconBuildingHospital size={15} aria-hidden="true" />
                                {rep.laboratory}
                              </span>
                            )}
                          </div>
                        )}

                        {notePreview && (
                          <FormattedMedicalText
                            text={notePreview}
                            className="history-card-desc"
                          />
                        )}

                        {highlightedRows.length > 0 && (
                          <div className="history-lab-highlights">
                            {highlightedRows.map((row, idx) => {
                              const st = rangeStatus(row);
                              return (
                                <div
                                  key={row.id ?? `${row.name}-${idx}`}
                                  className={`history-lab-chip is-${st}`}
                                >
                                  <span className="history-lab-chip-name">{row.name}</span>
                                  <strong>
                                    {row.value} {row.unit}
                                  </strong>
                                  {row.reference && (
                                    <small>
                                      {pl ? 'Norma:' : 'Ref:'} {row.reference}
                                    </small>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="history-card-footer">
                          <div className="history-card-tags">
                            <span className="history-product-pill">
                              {isDescriptive
                                ? pl
                                  ? 'Badanie opisowe / obrazowe'
                                  : 'Descriptive / imaging'
                                : pl
                                  ? `${rep.rows.length} parametrów`
                                  : `${rep.rows.length} parameters`}
                            </span>
                          </div>

                          <div className="history-card-actions">
                            {rep.source_path && (
                              <Link
                                className="history-action-link"
                                href={`/app/zwierzeta/${petId}?tab=documents&document=${rep.id}`}
                              >
                                <IconFileText size={15} aria-hidden="true" />
                                {pl ? 'Dokument źródłowy' : 'Source document'}
                              </Link>
                            )}
                            <Link
                              className="history-action-link is-primary"
                              href={`/app/zwierzeta/${petId}?tab=results&report=${rep.id}`}
                            >
                              <IconFlask size={15} aria-hidden="true" />
                              {isDescriptive
                                ? pl
                                  ? 'Pełny opis badania →'
                                  : 'Full report description →'
                                : pl
                                  ? 'Pełne wyniki badań →'
                                  : 'Full lab results →'}
                            </Link>
                          </div>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      {dialogOpen && (
        <HistoryDialog
          petId={petId}
          householdId={householdId}
          petName={petName}
          event={editing}
          defaultCategory={defaultDialogCategory}
          onClose={() => {
            setDialogOpen(false);
            setEditing(null);
          }}
          onSave={saved => {
            setEvents(prev => {
              const next = prev.filter(item => item.id !== saved.id);
              return [saved, ...next];
            });
            setDialogOpen(false);
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      {deleting && (
        <HistoryDeleteDialog
          petName={petName}
          title={deleting.title}
          date={formatDate(deleting.event_date)}
          pending={deletePending}
          error={deleteError}
          onClose={() => {
            if (!deletePending) {
              setDeleting(null);
              setDeleteError('');
            }
          }}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
