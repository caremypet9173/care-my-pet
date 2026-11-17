import type { Locale } from "@/i18n/types";
import type { Pet } from "./types";

export type TagSuggestionGroup = {
  key: "health" | "care";
  tags: string[];
};

export function getSuggestedPetTags(
  locale: Locale,
  sex: Pet["plec"] = "unknown",
): TagSuggestionGroup[] {
  if (locale === "en") {
    return [
      {
        key: "health",
        tags: [
          "oncology",
          "renal (CKD)",
          "diabetes",
          "allergies",
          "cardiology",
          "epilepsy",
          "thyroid",
          "asthma",
          "senior",
          "special diet",
        ],
      },
      {
        key: "care",
        tags: ["vet anxiety", "handle with care", "indoor only"],
      },
    ];
  }

  const onco =
    sex === "female"
      ? "onkologiczna"
      : sex === "male"
        ? "onkologiczny"
        : "onkologia";
  const indoor =
    sex === "female"
      ? "niewychodząca"
      : sex === "male"
        ? "niewychodzący"
        : "tylko w domu";

  return [
    {
      key: "health",
      tags: [
        onco,
        "nerkowiec",
        "cukrzyca",
        "alergik",
        "kardiologia",
        "padaczka",
        "tarczyca",
        "astma",
        "senior",
        "dieta specjalistyczna",
      ],
    },
    {
      key: "care",
      tags: ["stres u weta", "ostrożnie przy badaniu", indoor],
    },
  ];
}
