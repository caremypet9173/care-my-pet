import type { Translator } from "@/i18n/types";
import type { PetProfile } from "@/features/pets/types";
import { assets } from "@/lib/assets";
import { getLunaReport } from "./luna-record";

// Public, fictional fixture. Never use as a fallback for authenticated data.
export function getLuna(t: Translator) {
  return {
    name: "Luna",
    historyLabel: t("lunasHistory"),
    weightStatus: t("stable"),
    description: t("europeanShorthair4YearsFemale"),
    image: assets.luna,
    weightKg: 4.2,
    weights: [
      { date: "2026-07-15", kg: 4.1 },
      { date: "2026-08-15", kg: 4.2 },
      { date: "2026-09-15", kg: 4.2 },
    ],
    appointment: {
      date: "2026-10-12",
      previousDate: "2026-09-28",
      title: t("checkUp"),
      summary: t("nextCheckUpIn2Weeks"),
      note: t("bloodTestResultsWereDiscussedAndLunas323"),
    },
    report: getLunaReport(t),
  } satisfies PetProfile;
}
