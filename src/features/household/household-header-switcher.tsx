"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconChevronDown, IconCheck, IconHome, IconSettings } from "@tabler/icons-react";
import { Link } from "@/i18n/navigation";
import type { AvailableHouseholdItem } from "./types";

interface HouseholdHeaderSwitcherProps {
  availableHouseholds: AvailableHouseholdItem[];
  activeHouseholdId: string | null;
  locale: string;
}

export function HouseholdHeaderSwitcher({
  availableHouseholds,
  activeHouseholdId,
  locale,
}: HouseholdHeaderSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const pl = locale === "pl";

  const activeHousehold =
    availableHouseholds.find((h) => h.id === activeHouseholdId) ??
    availableHouseholds.find((h) => h.is_active) ??
    availableHouseholds[0];

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

  // Jeśli użytkownik ma tylko 1 gospodarstwo, wyświetlamy pojedynczy dyskretny znacznik
  if (availableHouseholds.length === 1 && activeHousehold) {
    return (
      <div className="household-header-single-badge" title={pl ? "Twoje gospodarstwo domowe" : "Your household"}>
        <IconHome size={15} aria-hidden="true" />
        <span className="household-header-single-name">{activeHousehold.nazwa}</span>
      </div>
    );
  }

  const handleSelect = (householdId: string) => {
    document.cookie = `care_active_household_id=${encodeURIComponent(
      householdId,
    )}; path=/; max-age=31536000; SameSite=Lax`;
    setIsOpen(false);

    // Jeśli jesteśmy na stronie gospodarstwa, przekierowujemy na query param nowego gospodarstwa
    if (pathname?.includes("/app/gospodarstwo")) {
      router.push(`/${locale}/app/gospodarstwo?id=${householdId}`);
    } else {
      router.refresh();
    }
  };

  return (
    <div className="household-header-switcher" ref={containerRef}>
      <button
        type="button"
        className="household-header-switcher-btn"
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
        <span className="household-header-switcher-role">
          {activeHousehold?.rola === "owner"
            ? pl
              ? "Właściciel"
              : "Owner"
            : pl
              ? "Współopiekun"
              : "Member"}
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
                            h.rola === "owner" ? "is-owner" : ""
                          }`}
                        >
                          {h.rola === "owner"
                            ? pl
                              ? "Właściciel"
                              : "Owner"
                            : pl
                              ? "Współopiekun"
                              : "Member"}
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
              href="/app/gospodarstwo"
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
