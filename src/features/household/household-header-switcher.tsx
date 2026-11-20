"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, Link } from "@/i18n/navigation";
import {
  IconChevronDown,
  IconCheck,
  IconHome,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import type { AvailableHouseholdItem } from "./types";
import { switchActiveHousehold } from "./actions";
import {
  HOUSEHOLD_CHANGE_EVENT,
  notifyHouseholdChange,
} from "./active-household-events";

interface HouseholdHeaderSwitcherProps {
  availableHouseholds: AvailableHouseholdItem[];
  activeHouseholdId: string | null;
  locale: string;
}

function getRoleLabel(rola: string, pl: boolean): string {
  if (rola === "owner") return pl ? "Właściciel" : "Owner";
  if (rola === "admin") return pl ? "Współadministrator" : "Co-admin";
  return pl ? "Współopiekun" : "Member";
}

export function HouseholdHeaderSwitcher({
  availableHouseholds,
  activeHouseholdId,
  locale,
}: HouseholdHeaderSwitcherProps) {
  const [prevActiveId, setPrevActiveId] = useState(activeHouseholdId);
  const [currentId, setCurrentId] = useState<string | null>(activeHouseholdId);

  // Synchronizacja przy zmianie propsa serwerowego bez kaskadowego efektu
  if (activeHouseholdId !== prevActiveId) {
    setPrevActiveId(activeHouseholdId);
    setCurrentId(activeHouseholdId);
  }

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const pl = locale === "pl";

  // Nasłuchiwanie na globalne zdarzenie zmiany aktywnego gospodarstwa
  useEffect(() => {
    function handleEvent(e: Event) {
      const customEvent = e as CustomEvent<{ householdId: string }>;
      const newId = customEvent.detail?.householdId;
      if (newId && availableHouseholds.some((h) => h.id === newId)) {
        setCurrentId(newId);
      }
    }

    window.addEventListener(HOUSEHOLD_CHANGE_EVENT, handleEvent);
    return () => {
      window.removeEventListener(HOUSEHOLD_CHANGE_EVENT, handleEvent);
    };
  }, [availableHouseholds]);

  // Obsługa kliknięcia poza menu i Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!availableHouseholds || availableHouseholds.length === 0) {
    return null;
  }

  const activeHousehold =
    availableHouseholds.find((h) => h.id === currentId) ??
    availableHouseholds.find((h) => h.id === activeHouseholdId) ??
    availableHouseholds.find((h) => h.is_active) ??
    availableHouseholds[0];

  // Jeśli użytkownik ma tylko 1 gospodarstwo, wyświetlamy pojedynczy znacznik
  if (availableHouseholds.length === 1 && activeHousehold) {
    const isOwner = activeHousehold.rola === "owner";
    return (
      <div
        className={`household-header-single-badge ${!isOwner ? "is-co-guardian" : ""}`}
        title={pl ? "Twoje gospodarstwo domowe" : "Your household"}
      >
        <IconHome size={15} aria-hidden="true" />
        <span className="household-header-single-name">{activeHousehold.nazwa}</span>
        {!isOwner && (
          <span className="household-header-switcher-role is-co-guardian">
            <IconUsers size={12} aria-hidden="true" />
            {getRoleLabel(activeHousehold.rola, pl)}
          </span>
        )}
      </div>
    );
  }

  const handleSelect = async (householdId: string) => {
    setCurrentId(householdId);
    setIsOpen(false);
    notifyHouseholdChange(householdId);

    await switchActiveHousehold(householdId);

    if (pathname?.includes("/app/household")) {
      router.push(`/app/household?id=${householdId}`);
    }
    router.refresh();
  };

  const isCoGuardian = activeHousehold?.rola !== "owner";

  return (
    <div className="household-header-switcher" ref={containerRef}>
      <button
        type="button"
        className={`household-header-switcher-btn ${isCoGuardian ? "is-co-guardian" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={pl ? "Przełącz gospodarstwo domowe" : "Switch household"}
      >
        <span className="household-switcher-home-icon">
          <IconHome size={16} aria-hidden="true" />
        </span>
        <span className="household-header-switcher-name">
          {activeHousehold ? activeHousehold.nazwa : pl ? "Wybierz gospodarstwo" : "Select household"}
        </span>
        <span
          className={`household-header-switcher-role ${
            isCoGuardian ? "is-co-guardian" : "is-owner"
          }`}
        >
          {isCoGuardian ? <IconUsers size={12} aria-hidden="true" /> : null}
          {getRoleLabel(activeHousehold?.rola ?? "member", pl)}
        </span>
        <IconChevronDown
          size={14}
          className={`household-header-chevron ${isOpen ? "is-open" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div className="household-header-dropdown" role="menu">
          <div className="household-header-dropdown-header">
            {pl ? "Przełącz gospodarstwo:" : "Switch household:"}
          </div>
          <ul className="household-header-dropdown-list">
            {availableHouseholds.map((h) => {
              const isSelected = h.id === activeHousehold?.id;
              const itemIsCoGuardian = h.rola !== "owner";
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    role="menuitem"
                    className={`household-header-dropdown-item ${
                      isSelected ? "is-active" : ""
                    }`}
                    onClick={() => handleSelect(h.id)}
                  >
                    <div className="household-header-dropdown-item-left">
                      <IconHome size={16} aria-hidden="true" />
                      <div className="household-header-dropdown-info">
                        <span className="household-header-dropdown-title">
                          {h.nazwa}
                        </span>
                        <span
                          className={`household-header-dropdown-role ${
                            itemIsCoGuardian ? "is-co-guardian" : "is-owner"
                          }`}
                        >
                          {itemIsCoGuardian ? (
                            <IconUsers size={11} aria-hidden="true" />
                          ) : null}
                          {getRoleLabel(h.rola, pl)}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <IconCheck
                        size={16}
                        className="household-header-dropdown-check"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="household-header-dropdown-footer">
            <Link
              href="/app/household"
              className="household-header-dropdown-manage-link"
              onClick={() => setIsOpen(false)}
            >
              <IconSettings size={15} aria-hidden="true" />
              <span>{pl ? "Zarządzaj gospodarstwami" : "Manage households"}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
