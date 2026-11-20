"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  IconCat,
  IconCheck,
  IconChevronDown,
  IconDog,
} from "@tabler/icons-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/types";
import { petMessages } from "./messages";
import type { Pet } from "./types";

export type PetSwitcherItem = Pick<
  Pet,
  "id" | "imie" | "gatunek" | "avatar_url" | "tagi"
>;

const MAX_PILL_PETS = 5;
const ALLOWED_TABS = new Set([
  "weight",
  "measurements",
  "history",
  "results",
  "documents",
  "assistant",
]);

function buildPetHref(petId: string, tab: string | null): string {
  return tab ? `/app/pets/${petId}?tab=${encodeURIComponent(tab)}` : `/app/pets/${petId}`;
}

function PetMiniAvatar({
  pet,
  size = "sm",
}: {
  pet: PetSwitcherItem;
  size?: "sm" | "md";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const Icon = pet.gatunek === "cat" ? IconCat : IconDog;
  const iconSize = size === "md" ? 16 : 13;

  const pxSize = size === "md" ? 32 : 24;

  if (pet.avatar_url && pet.avatar_url !== failedSrc) {
    return (
      <span className={`pet-switcher-avatar is-${size} has-photo`}>
        {/* Signed private image: never cache it through the public optimizer. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pet.avatar_url}
          alt=""
          width={pxSize}
          height={pxSize}
          onError={() => setFailedSrc(pet.avatar_url ?? null)}
        />
      </span>
    );
  }

  return (
    <span className={`pet-switcher-avatar is-${size}`} aria-hidden="true">
      <Icon size={iconSize} stroke={1.7} />
    </span>
  );
}

function PetSwitcherMarkup({
  pets,
  currentPetId,
  locale,
  activeTab,
}: {
  pets: PetSwitcherItem[];
  currentPetId: string;
  locale: Locale;
  activeTab: string | null;
}) {
  const t = petMessages[locale];
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

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
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const currentPet = pets.find((p) => p.id === currentPetId) ?? pets[0];
  if (!currentPet) return null;

  const showPillsOnDesktop = pets.length <= MAX_PILL_PETS;

  return (
    <nav className="pet-switcher" aria-label={t.petsInHousehold}>
      {showPillsOnDesktop && (
        <div className="pet-switcher-pills">
          {pets.map((item) => {
            const isActive = item.id === currentPetId;
            if (isActive) {
              return (
                <span
                  key={item.id}
                  className="pet-switcher-pill is-active"
                  aria-current="page"
                >
                  <PetMiniAvatar pet={item} size="sm" />
                  <span className="pet-switcher-pill-name">{item.imie}</span>
                </span>
              );
            }
            return (
              <Link
                key={item.id}
                href={buildPetHref(item.id, activeTab)}
                className="pet-switcher-pill"
                title={`${item.imie} (${t[item.gatunek]})`}
              >
                <PetMiniAvatar pet={item} size="sm" />
                <span className="pet-switcher-pill-name">{item.imie}</span>
              </Link>
            );
          })}
        </div>
      )}

      <div
        ref={containerRef}
        className={`pet-switcher-dropdown-wrap${showPillsOnDesktop ? " is-responsive" : ""}`}
      >
        <button
          ref={triggerRef}
          type="button"
          className="pet-switcher-trigger"
          aria-expanded={isOpen}
          aria-label={`${t.switchPet}: ${currentPet.imie}`}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <PetMiniAvatar pet={currentPet} size="sm" />
          <span className="pet-switcher-trigger-name">{currentPet.imie}</span>
          <IconChevronDown
            size={15}
            className={`pet-switcher-chevron${isOpen ? " is-open" : ""}`}
            aria-hidden="true"
          />
        </button>

        {isOpen && (
          <div
            className="pet-switcher-menu"
            role="region"
            aria-label={t.petsInHousehold}
          >
            <div className="pet-switcher-menu-header">{t.petsInHousehold}</div>
            <ul className="pet-switcher-menu-list">
              {pets.map((item) => {
                const isActive = item.id === currentPetId;
                const tags = (item.tagi ?? []).slice(0, 2);
                return (
                  <li key={item.id}>
                    <Link
                      href={buildPetHref(item.id, activeTab)}
                      className={`pet-switcher-option${isActive ? " is-active" : ""}`}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => setIsOpen(false)}
                    >
                      <PetMiniAvatar pet={item} size="md" />
                      <span className="pet-switcher-option-text">
                        <strong>{item.imie}</strong>
                        <small>
                          {t[item.gatunek]}
                          {tags.length > 0 ? ` · ${tags.join(", ")}` : ""}
                        </small>
                      </span>
                      {isActive && (
                        <IconCheck
                          size={16}
                          className="pet-switcher-option-check"
                          aria-hidden="true"
                        />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </nav>
  );
}

function PetSwitcherWithSearchParams({
  pets,
  currentPetId,
  locale,
  initialTab,
}: {
  pets: PetSwitcherItem[];
  currentPetId: string;
  locale: Locale;
  initialTab: string | null;
}) {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const activeTab =
    tab && ALLOWED_TABS.has(tab)
      ? tab
      : !tab && searchParams.has("document")
        ? "documents"
        : !tab && searchParams.has("prompt")
          ? "assistant"
          : initialTab;

  return (
    <PetSwitcherMarkup
      pets={pets}
      currentPetId={currentPetId}
      locale={locale}
      activeTab={activeTab}
    />
  );
}

export function PetSwitcher({
  pets,
  currentPetId,
  locale,
  initialTab = null,
}: {
  pets: PetSwitcherItem[];
  currentPetId: string;
  locale: Locale;
  initialTab?: string | null;
}) {
  if (pets.length <= 1) return null;

  return (
    <Suspense
      fallback={
        <PetSwitcherMarkup
          pets={pets}
          currentPetId={currentPetId}
          locale={locale}
          activeTab={initialTab}
        />
      }
    >
      <PetSwitcherWithSearchParams
        pets={pets}
        currentPetId={currentPetId}
        locale={locale}
        initialTab={initialTab}
      />
    </Suspense>
  );
}
