"use client";

export const HOUSEHOLD_CHANGE_EVENT = "care:household-change";

export function notifyHouseholdChange(householdId: string) {
  if (typeof window === "undefined") return;

  // 1. Zapis ciasteczka w przeglądarce natychmiast
  try {
    document.cookie = `care_active_household_id=${encodeURIComponent(
      householdId,
    )}; path=/; max-age=31536000; SameSite=Lax`;
  } catch (e) {
    console.error("[notifyHouseholdChange cookie error]", e);
  }

  // 2. Wysłanie lokalnego zdarzenia do wszystkich słuchaczy w UI
  try {
    window.dispatchEvent(
      new CustomEvent(HOUSEHOLD_CHANGE_EVENT, {
        detail: { householdId },
      }),
    );
  } catch (e) {
    console.error("[notifyHouseholdChange event error]", e);
  }
}
