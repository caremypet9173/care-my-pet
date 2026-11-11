"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocale } from "next-intl";
import { IconList, IconHistory, IconFlask, IconFiles, IconActivity, IconSparkles } from "@tabler/icons-react";
import { dashboardMessages } from "./dashboard-messages";
import { usePetQuickAddOptional } from "./pet-quick-actions";

const TAB_QUERY_MAP: Record<number, string | null> = {
  0: null,
  4: "weight",
  1: "history",
  2: "results",
  3: "documents",
  5: "assistant",
};

export function RecordSections({
  children,
  history,
  results,
  weight,
  documents,
  assistant,
  initialTab = 0,
}: {
  children: ReactNode;
  history?: ReactNode;
  results?: ReactNode;
  weight?: ReactNode;
  documents?: ReactNode;
  assistant?: ReactNode;
  initialTab?: number;
}) {
  const locale = useLocale();
  const d = dashboardMessages[locale];
  const quickAdd = usePetQuickAddOptional();
  const navTarget = quickAdd?.navTarget ?? null;
  const [selected, setSelected] = useState(initialTab);
  const [visited, setVisited] = useState<Set<number>>(() => new Set([initialTab]));
  const [prevNavSeq, setPrevNavSeq] = useState<number>(navTarget?.seq ?? 0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  if (navTarget && navTarget.seq !== prevNavSeq) {
    setPrevNavSeq(navTarget.seq);
    setSelected(navTarget.tab);
    setVisited((prev) => {
      if (prev.has(navTarget.tab)) return prev;
      const next = new Set(prev);
      next.add(navTarget.tab);
      return next;
    });
  }

  useEffect(() => {
    if (!navTarget) return;
    try {
      const url = new URL(window.location.href);
      const queryVal = TAB_QUERY_MAP[navTarget.tab];
      if (queryVal) {
        url.searchParams.set("tab", queryVal);
      } else {
        url.searchParams.delete("tab");
      }
      window.history.replaceState(null, "", url.pathname + url.search);
    } catch {}
  }, [navTarget]);

  const tabs = [
    { id: 0, label: d.summary, icon: IconList, text: "" },
    { id: 1, label: d.history, icon: IconHistory, text: d.noEvents },
    { id: 2, label: d.results, icon: IconFlask, text: d.noResults },
    { id: 3, label: d.documents, icon: IconFiles, text: d.noDocuments },
    { id: 5, label: locale === "pl" ? "Asystent AI" : "AI Assistant", icon: IconSparkles, text: "" },
  ];
  tabs.splice(1, 0, { id: 4, label: locale === "pl" ? "Pomiary zdrowia" : "Health measurements", icon: IconActivity, text: "" });

  function selectTab(tabId: number) {
    setSelected(tabId);
    setVisited((prev) => {
      if (prev.has(tabId)) return prev;
      const next = new Set(prev);
      next.add(tabId);
      return next;
    });

    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        const queryVal = TAB_QUERY_MAP[tabId];
        if (queryVal) {
          url.searchParams.set("tab", queryVal);
        } else {
          url.searchParams.delete("tab");
        }
        window.history.replaceState(null, "", url.pathname + url.search);
      } catch {}
    }
  }

  return (
    <>
      <div
        className="household-record-tabs"
        role="tablist"
        aria-label={d.record}
        onKeyDown={(event) => {
          const position = tabs.findIndex((tab) => tab.id === selected);
          const next =
            event.key === "ArrowRight"
              ? (position + 1) % tabs.length
              : event.key === "ArrowLeft"
                ? (position + tabs.length - 1) % tabs.length
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? tabs.length - 1
                    : null;
          if (next !== null) {
            event.preventDefault();
            const targetTab = tabs[next];
            selectTab(targetTab.id);
            refs.current[targetTab.id]?.focus();
          }
        }}
      >
        {tabs.map(({ label, icon: Icon, id: tabId }) => (
          <button
            key={label}
            ref={(node) => {
              refs.current[tabId] = node;
            }}
            type="button"
            role="tab"
            id={`record-tab-${tabId}`}
            aria-controls={`record-panel-${tabId}`}
            aria-selected={selected === tabId}
            tabIndex={selected === tabId ? 0 : -1}
            onClick={() => selectTab(tabId)}
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {tabs.map((tab) => {
        const isVisited = visited.has(tab.id);
        return (
          <div
            key={tab.label}
            role="tabpanel"
            id={`record-panel-${tab.id}`}
            aria-labelledby={`record-tab-${tab.id}`}
            hidden={selected !== tab.id}
            tabIndex={0}
          >
            {isVisited ? (
              tab.id === 0 ? (
                children
              ) : tab.id === 1 && history ? (
                history
              ) : tab.id === 4 && weight ? (
                weight
              ) : tab.id === 2 && results ? (
                results
              ) : tab.id === 3 && documents ? (
                documents
              ) : tab.id === 5 && assistant ? (
                assistant
              ) : (
                <section className="pet-panel household-record-empty">
                  <tab.icon size={32} aria-hidden="true" />
                  <h2>{tab.label}</h2>
                  <p>{tab.text}</p>
                  <span className="household-tag">{d.upcoming}</span>
                </section>
              )
            ) : null}
          </div>
        );
      })}
    </>
  );
}
