import type { Measurement } from "./types";

function parseNumeric(value: string): number | null {
  const text = value.trim().replace(",", ".");
  if (!/^-?\d+(?:\.\d+)?$/.test(text)) {
    return null;
  }
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

export type ParameterSpec = {
  key: string;
  labelPl: string;
  labelEn: string;
  dimension?: UnitDimension;
  diffKind?: "auto";
  aliases: string[];
};

export type UnitDimension =
  | "creatinine"
  | "urea"
  | "mass_conc"
  | "fraction_pct"
  | "glucose"
  | "cholesterol"
  | "triglycerides"
  | "bilirubin"
  | "calcium"
  | "phosphorus"
  | "count_high"
  | "count_low"
  | "enzyme"
  | "electrolyte"
  | "osmolality";

function foldName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[()[\]:/.,_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
};

export function normalizeUnit(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // Rozróżniamy wielkość liter dla G/L (Giga/L = 10^9/L) vs g/L (gram/L), z tolerancją literówki OCR /LL
  if (/^g\/l{1,2}$/i.test(trimmed)) {
    return trimmed[0] === "G" ? "10^9/l" : "g/l";
  }

  let s = trimmed
    .toLowerCase()
    .replace(/[µμ]/g, "u")
    .replace(/\s+/g, "")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (seq) => `^${seq.split("").map((ch) => SUPERSCRIPT_DIGITS[ch] ?? ch).join("")}`)
    .replace(/^[x×*·]+(?=10)/, "")
    .replace(/10(?:\*|e)(?=\d)/g, "10^");

  // Korekta częstej literówki OCR typu "/LL" na końcu jednostki (np. "x10^12/LL" -> "10^12/l")
  if (s.endsWith("/ll")) {
    s = s.slice(0, -1);
  }

  if (s === "mg/dl" || s === "mg/100ml") return "mg/dl";
  if (s === "umol/l" || s === "mcmol/l") return "umol/l";
  if (s === "mmol/l") return "mmol/l";
  if (s === "meq/l") return "meq/l";
  if (s === "g/dl") return "g/dl";
  if (s === "g/l") return "g/l";
  if (s === "mg/l") return "mg/l";
  if (s === "l/l") return "l/l";
  if (s === "%") return "%";
  if (s === "u/l" || s === "iu/l" || s === "j/l" || s === "u/i") return "u/l";
  if (
    s === "10^9/l" ||
    s === "10^3/ul" ||
    s === "k/ul" ||
    s === "tys/ul" ||
    s === "tys./ul" ||
    s === "10^3/mm3" ||
    s === "10^3/mm^3"
  ) {
    return "10^9/l";
  }
  if (
    s === "10^12/l" ||
    s === "t/l" ||
    s === "10^6/ul" ||
    s === "m/ul" ||
    s === "mln/ul" ||
    s === "10^6/mm3" ||
    s === "10^6/mm^3"
  ) {
    return "10^12/l";
  }
  if (s === "fl") return "fl";
  if (s === "pg") return "pg";
  if (s === "mosm/kg") return "mosm/kg";

  return s;
}

// Współczynniki konwersji do jednostki bazowej danej wielkości (wartość_bazowa = wartość * factor)
const UNIT_FACTORS: Record<UnitDimension, Record<string, number>> = {
  creatinine: {
    "mg/dl": 1,
    "umol/l": 1 / 88.4,
  },
  urea: {
    "mg/dl": 1,
    "mmol/l": 6.006,
  },
  mass_conc: {
    "g/dl": 10,
    "g/l": 1,
    "mg/dl": 0.01,
    "mg/l": 0.001,
  },
  fraction_pct: {
    "%": 1,
    "l/l": 100,
  },
  glucose: {
    "mg/dl": 1,
    "mmol/l": 18.016,
  },
  cholesterol: {
    "mg/dl": 1,
    "mmol/l": 38.67,
  },
  triglycerides: {
    "mg/dl": 1,
    "mmol/l": 88.57,
  },
  bilirubin: {
    "mg/dl": 1,
    "umol/l": 1 / 17.104,
  },
  calcium: {
    "mg/dl": 1,
    "mmol/l": 4.008,
  },
  phosphorus: {
    "mg/dl": 1,
    "mmol/l": 3.097,
  },
  count_high: {
    "10^12/l": 1,
  },
  count_low: {
    "10^9/l": 1,
  },
  enzyme: {
    "u/l": 1,
  },
  electrolyte: {
    "mmol/l": 1,
    "meq/l": 1,
  },
  osmolality: {
    "mosm/kg": 1,
  },
};

export const PARAMETER_SPECS: ParameterSpec[] = [
  // Profil nerkowy i elektrolity
  {
    key: "creatinine",
    labelPl: "Kreatynina",
    labelEn: "Creatinine",
    dimension: "creatinine",
    aliases: ["kreatynina", "creatinine", "crea", "krea", "cre", "kreat"],
  },
  {
    key: "urea",
    labelPl: "Mocznik",
    labelEn: "Urea",
    dimension: "urea",
    aliases: ["mocznik", "urea", "ure"],
  },
  {
    key: "sdma",
    labelPl: "SDMA",
    labelEn: "SDMA",
    aliases: ["sdma"],
  },
  {
    key: "upc",
    labelPl: "Stosunek białka do kreatyniny",
    labelEn: "Urine Protein:Creatinine Ratio (UPC)",
    aliases: [
      "stosunek bialka do kreatyniny",
      "bialko kreatynina w moczu",
      "stosunek bialko kreatynina",
      "upc",
      "urine protein creatinine ratio",
      "protein creatinine ratio",
    ],
  },
  {
    key: "phosphorus",
    labelPl: "Fosfor",
    labelEn: "Phosphorus",
    dimension: "phosphorus",
    aliases: ["fosfor", "phosphorus", "phosphate", "fosforan", "fosfor nieorganiczny", "phos", "p"],
  },
  {
    key: "calcium",
    labelPl: "Wapń",
    labelEn: "Calcium",
    dimension: "calcium",
    aliases: ["wapn", "wapn calkowity", "calcium", "ca"],
  },
  {
    key: "sodium",
    labelPl: "Sód",
    labelEn: "Sodium",
    dimension: "electrolyte",
    aliases: ["sod", "sodium", "na"],
  },
  {
    key: "potassium",
    labelPl: "Potas",
    labelEn: "Potassium",
    dimension: "electrolyte",
    aliases: ["potas", "potassium", "k"],
  },
  {
    key: "chloride",
    labelPl: "Chlorki",
    labelEn: "Chloride",
    dimension: "electrolyte",
    aliases: ["chlorki", "chloride", "chlor", "cl"],
  },

  // Morfologia
  {
    key: "wbc",
    labelPl: "WBC (Leukocyty)",
    labelEn: "WBC",
    dimension: "count_low",
    aliases: ["wbc", "leukocyty", "krwinki biale", "leukocytes", "white blood cells"],
  },
  {
    key: "rbc",
    labelPl: "RBC (Erytrocyty)",
    labelEn: "RBC",
    dimension: "count_high",
    aliases: ["rbc", "erytrocyty", "krwinki czerwone", "erythrocytes", "red blood cells"],
  },
  {
    key: "hgb",
    labelPl: "HGB (Hemoglobina)",
    labelEn: "HGB",
    dimension: "mass_conc",
    aliases: ["hgb", "hb", "hemoglobina", "hemoglobin"],
  },
  {
    key: "hct",
    labelPl: "HCT (Hematokryt)",
    labelEn: "HCT",
    dimension: "fraction_pct",
    aliases: ["hct", "ht", "hematokryt", "hematocrit", "pcv"],
  },
  {
    key: "mcv",
    labelPl: "MCV",
    labelEn: "MCV",
    aliases: ["mcv"],
  },
  {
    key: "mch",
    labelPl: "MCH",
    labelEn: "MCH",
    aliases: ["mch"],
  },
  {
    key: "mchc",
    labelPl: "MCHC",
    labelEn: "MCHC",
    dimension: "mass_conc",
    aliases: ["mchc"],
  },
  {
    key: "plt",
    labelPl: "PLT (Płytki krwi)",
    labelEn: "PLT",
    dimension: "count_low",
    aliases: ["plt", "plytki krwi", "trombocyty", "platelets", "thrombocytes"],
  },
  {
    key: "retic",
    labelPl: "Retikulocyty",
    labelEn: "Reticulocytes",
    diffKind: "auto",
    dimension: "count_low",
    aliases: ["retic", "retikulocyty", "reticulocytes", "ret", "retik"],
  },
  {
    key: "neu",
    labelPl: "Neutrofile",
    labelEn: "Neutrophils",
    diffKind: "auto",
    dimension: "count_low",
    aliases: ["neu", "neut", "neutrofile", "neutrophils", "granulocyty obojetnochlonne", "seg"],
  },
  {
    key: "lym",
    labelPl: "Limfocyty",
    labelEn: "Lymphocytes",
    diffKind: "auto",
    dimension: "count_low",
    aliases: ["lym", "lymph", "limfocyty", "lymphocytes"],
  },
  {
    key: "mono",
    labelPl: "Monocyty",
    labelEn: "Monocytes",
    diffKind: "auto",
    dimension: "count_low",
    aliases: ["mono", "mon", "monocyty", "monocytes"],
  },
  {
    key: "eos",
    labelPl: "Eozynofile",
    labelEn: "Eosinophils",
    diffKind: "auto",
    dimension: "count_low",
    aliases: ["eos", "eozynofile", "eosinophils", "kwasochlonne"],
  },
  {
    key: "baso",
    labelPl: "Bazofile",
    labelEn: "Basophils",
    diffKind: "auto",
    dimension: "count_low",
    aliases: ["baso", "bas", "bazofile", "basophils", "zasadochlonne"],
  },

  // Profil wątrobowy i biochemia
  {
    key: "alt",
    labelPl: "ALT (ALAT / GPT)",
    labelEn: "ALT",
    dimension: "enzyme",
    aliases: ["alt", "alat", "gpt", "aminotransferaza alaninowa", "alanine aminotransferase"],
  },
  {
    key: "ast",
    labelPl: "AST (ASPAT / GOT)",
    labelEn: "AST",
    dimension: "enzyme",
    aliases: ["ast", "aspat", "got", "aminotransferaza asparaginianowa", "aspartate aminotransferase"],
  },
  {
    key: "alp",
    labelPl: "ALP (Fosfataza zasadowa)",
    labelEn: "ALP",
    dimension: "enzyme",
    aliases: ["alp", "alkp", "ap", "fosfataza zasadowa", "fosfataza alkaliczna", "alkaline phosphatase"],
  },
  {
    key: "ggt",
    labelPl: "GGT (GGTP)",
    labelEn: "GGT",
    dimension: "enzyme",
    aliases: ["ggt", "ggtp", "gamma glutamylotransferase"],
  },
  {
    key: "tbil",
    labelPl: "Bilirubina całkowita",
    labelEn: "Total Bilirubin",
    dimension: "bilirubin",
    aliases: ["bilirubina", "bilirubina calkowita", "tbil", "total bilirubin", "bilirubin"],
  },
  {
    key: "tp",
    labelPl: "Białko całkowite",
    labelEn: "Total Protein",
    dimension: "mass_conc",
    aliases: ["bialko calkowite", "total protein", "tp"],
  },
  {
    key: "alb",
    labelPl: "Albumina",
    labelEn: "Albumin",
    dimension: "mass_conc",
    aliases: ["albumina", "albuminy", "albumin", "alb"],
  },
  {
    key: "glob",
    labelPl: "Globuliny",
    labelEn: "Globulins",
    dimension: "mass_conc",
    aliases: ["globuliny", "globulina", "globulins", "globulin", "glob"],
  },
  {
    key: "glu",
    labelPl: "Glukoza",
    labelEn: "Glucose",
    dimension: "glucose",
    aliases: ["glukoza", "glucose", "glu"],
  },
  {
    key: "chol",
    labelPl: "Cholesterol",
    labelEn: "Cholesterol",
    dimension: "cholesterol",
    aliases: ["cholesterol", "cholesterol calkowity", "chol"],
  },
  {
    key: "trig",
    labelPl: "Trójglicerydy",
    labelEn: "Triglycerides",
    dimension: "triglycerides",
    aliases: ["trojglicerydy", "triglicerydy", "triglycerides", "trig", "tg"],
  },
  {
    key: "amyl",
    labelPl: "Amylaza",
    labelEn: "Amylase",
    dimension: "enzyme",
    aliases: ["amylaza", "amylase", "amyl"],
  },
  {
    key: "lipa",
    labelPl: "Lipaza",
    labelEn: "Lipase",
    dimension: "enzyme",
    aliases: ["lipaza", "lipase", "lipa"],
  },
];

const ALIAS_LOOKUP = new Map<string, ParameterSpec>();
for (const spec of PARAMETER_SPECS) {
  for (const alias of spec.aliases) {
    ALIAS_LOOKUP.set(foldName(alias), spec);
  }
}

export type ResolvedParameterIdentity = {
  key: string;
  displayName: string;
  dimension?: UnitDimension;
  isPercentageDiff: boolean;
};

export function resolveParameterIdentity(
  row: Pick<Measurement, "name" | "unit">,
  locale: "pl" | "en",
): ResolvedParameterIdentity {
  const rawName = row.name.trim();
  const unitNorm = normalizeUnit(row.unit);
  const isPct = unitNorm === "%" || /%/.test(rawName);
  const nameWithoutHashPct = foldName(rawName.replace(/[%#]/g, " "));

  const spec = ALIAS_LOOKUP.get(foldName(rawName)) ?? ALIAS_LOOKUP.get(nameWithoutHashPct);

  if (spec) {
    if (spec.diffKind === "auto") {
      const suffix = isPct ? "pct" : "abs";
      const baseLabel = locale === "pl" ? spec.labelPl : spec.labelEn;
      return {
        key: `${spec.key}:${suffix}`,
        displayName: `${baseLabel} (${isPct ? "%" : "#"})`,
        dimension: isPct ? "fraction_pct" : spec.dimension,
        isPercentageDiff: isPct,
      };
    }

    return {
      key: spec.key,
      displayName: locale === "pl" ? spec.labelPl : spec.labelEn,
      dimension: spec.dimension,
      isPercentageDiff: false,
    };
  }

  return {
    key: `raw:${foldName(rawName)}`,
    displayName: rawName,
    isPercentageDiff: false,
  };
}

export function convertMeasurementValue(
  value: number,
  fromUnit: string,
  toUnit: string,
  dimension?: UnitDimension,
): number | null {
  const fromNorm = normalizeUnit(fromUnit);
  const toNorm = normalizeUnit(toUnit);
  if (!fromNorm || !toNorm) return null;
  if (fromNorm === toNorm) return value;
  if (!dimension) return null;

  const table = UNIT_FACTORS[dimension];
  const fromFactor = table[fromNorm];
  const toFactor = table[toNorm];
  if (!fromFactor || !toFactor) return null;

  return (value * fromFactor) / toFactor;
}

export function formatConvertedNumber(value: number, locale: "pl" | "en"): string {
  const abs = Math.abs(value);
  const maxFractionDigits = abs >= 100 ? 1 : abs >= 10 ? 2 : 3;
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: maxFractionDigits,
    useGrouping: false,
  }).format(value);
}

export function computeReferenceRatio(row: Pick<Measurement, "value" | "reference">): number | null {
  const num = parseNumeric(row.value);
  if (num === null) return null;
  const match = row.reference
    .trim()
    .match(/^(-?\d+(?:[.,]\d+)?)\s*[-–—]\s*(-?\d+(?:[.,]\d+)?)$/);
  if (!match) return null;
  const low = parseNumeric(match[1]);
  const high = parseNumeric(match[2]);
  if (low === null || high === null || high <= low) return null;
  return (num - low) / (high - low);
}

export type DateReportGroup<T> = {
  key: string;
  testDate: string;
  items: T[];
};

/**
 * Grupuje badania laboratoryjne po dacie (`test_date`), zachowując kolejność
 * wejściową raportów wewnątrz dnia (od najnowszego `confirmed_at`).
 */
export function groupReportsByDate<T>(
  reportsDesc: T[],
  getDate: (rep: T) => string,
): DateReportGroup<T>[] {
  const byDate = new Map<string, DateReportGroup<T>>();

  for (const rep of reportsDesc) {
    const testDate = getDate(rep);
    let group = byDate.get(testDate);
    if (!group) {
      group = {
        key: testDate,
        testDate,
        items: [],
      };
      byDate.set(testDate, group);
    }
    group.items.push(rep);
  }

  return Array.from(byDate.values());
}
