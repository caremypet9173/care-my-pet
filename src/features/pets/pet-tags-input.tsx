"use client";

import { useState, type KeyboardEvent } from "react";
import { IconCheck, IconPlus, IconTag, IconX } from "@tabler/icons-react";
import type { Locale } from "@/i18n/types";
import {
  MAX_PET_TAGS,
  MAX_PET_TAG_LENGTH,
} from "../../../supabase/functions/pets/validation.mjs";
import { getSuggestedPetTags } from "./tag-suggestions";
import { petMessages } from "./messages";
import { petFormMessages } from "./form-messages";
import type { Pet } from "./types";

function normalizeTagValue(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function PetTagsInput({
  locale,
  sex,
  value,
  onChange,
  error,
}: {
  locale: Locale;
  sex: Pet["plec"];
  value: string[];
  onChange: (next: string[]) => void;
  error?: string;
}) {
  const t = petMessages[locale];
  const d = petFormMessages[locale];
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState("");

  const groups = getSuggestedPetTags(locale, sex);
  const findIndexIgnoreCase = (candidate: string, list: string[]) => {
    const key = candidate.toLocaleLowerCase("pl-PL");
    return list.findIndex((item) => item.toLocaleLowerCase("pl-PL") === key);
  };

  function addTag(raw: string) {
    const clean = normalizeTagValue(raw);
    if (!clean) {
      setLocalError("");
      return;
    }
    if (clean.length > MAX_PET_TAG_LENGTH) {
      setLocalError(d.tagsTooLong);
      return;
    }
    if (findIndexIgnoreCase(clean, value) !== -1) {
      setDraft("");
      setLocalError("");
      return;
    }
    if (value.length >= MAX_PET_TAGS) {
      setLocalError(d.tagsLimit);
      return;
    }
    setLocalError("");
    setDraft("");
    onChange([...value, clean]);
  }

  function removeTag(index: number) {
    setLocalError("");
    onChange(value.filter((_, idx) => idx !== index));
  }

  function toggleSuggested(tag: string) {
    const existingIndex = findIndexIgnoreCase(tag, value);
    if (existingIndex !== -1) {
      removeTag(existingIndex);
      return;
    }
    addTag(tag);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag(draft);
    }
  }

  const displayedError = localError || error;
  const atLimit = value.length >= MAX_PET_TAGS;

  return (
    <div className="pet-form-field pet-tags-field">
      <label htmlFor="pet-tag-input">
        <span>{t.tagi}</span>
        <small>
          {value.length} / {MAX_PET_TAGS}
        </small>
      </label>

      {value.length > 0 && (
        <ul className="pet-selected-tags" aria-label={t.tagi}>
          {value.map((tag, index) => (
            <li key={tag}>
              <span className="pet-selected-tag">
                <IconTag size={12} aria-hidden="true" />
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(index)}
                  aria-label={`${d.tagsRemove}: ${tag}`}
                >
                  <IconX size={13} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="pet-tag-input-row">
        <input
          id="pet-tag-input"
          type="text"
          maxLength={MAX_PET_TAG_LENGTH}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (localError) setLocalError("");
          }}
          onKeyDown={handleKeyDown}
          placeholder={d.tagsPlaceholder}
          aria-describedby={
            displayedError ? "tags-hint tags-error" : "tags-hint"
          }
          aria-invalid={!!displayedError}
        />
        <button
          type="button"
          className="button button--secondary button--sm pet-tag-add-btn"
          disabled={!draft.trim() || atLimit}
          onClick={() => addTag(draft)}
        >
          <IconPlus size={15} aria-hidden="true" />
          <span>{d.tagsAdd}</span>
        </button>
      </div>

      <small id="tags-hint">{d.tagsHint}</small>

      {displayedError && (
        <p className="pet-field-error" id="tags-error" role="alert">
          {displayedError}
        </p>
      )}

      <div className="pet-tag-suggestions">
        {groups.map((group) => (
          <div key={group.key} className="pet-tag-suggestion-group">
            <span>
              {group.key === "health" ? d.tagsGroupHealth : d.tagsGroupCare}
            </span>
            <div className="pet-tag-suggestion-list">
              {group.tags.map((tag) => {
                const active = findIndexIgnoreCase(tag, value) !== -1;
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    className={`pet-tag-chip${active ? " is-active" : ""}`}
                    disabled={!active && atLimit}
                    onClick={() => toggleSuggested(tag)}
                  >
                    {active ? (
                      <IconCheck size={13} aria-hidden="true" />
                    ) : (
                      <IconPlus size={13} aria-hidden="true" />
                    )}
                    <span>{tag}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
