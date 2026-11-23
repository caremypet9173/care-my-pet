"use client";

import type { ReactNode } from "react";
import { usePetQuickAddOptional } from "./pet-quick-actions";

/**
 * Keeps the full PetHeroCover on the Summary tab (`activeTab === null`)
 * and smoothly collapses it into a sleek ~60px identity strip on work tabs
 * (Health measurements, History, Lab results, Documents, AI Assistant).
 */
export function PetHeroModeWrapper({ children }: { children: ReactNode }) {
  const quickAdd = usePetQuickAddOptional();
  const isCompact = Boolean(quickAdd?.activeTab);
  return (
    <div className={`pet-hero-adaptive${isCompact ? " is-compact" : ""}`}>
      {children}
    </div>
  );
}
