export interface MemberNameInput {
  user_id: string;
  email?: string | null;
  fallback?: string;
}

function capitalizeWord(word: string): string {
  if (!word) return "";
  return word.charAt(0).toLocaleUpperCase("pl-PL") + word.slice(1).toLocaleLowerCase("pl-PL");
}

function extractNameTokens(email?: string | null): string[] {
  if (!email) return [];
  const localPart = email.split("@")[0]?.trim() ?? "";
  if (!localPart) return [];
  return localPart
    .split(/[._\-+]+/)
    .map((part) => part.replace(/\d+$/g, "").trim())
    .filter((part) => part.length >= 2);
}

/**
 * Formats household member emails into concise, readable display names
 * (e.g. "wojciech.krzysztof.dobrowolski@gmail.com" -> "Wojciech").
 * Appends a last-token initial automatically when two members share the same first name.
 */
export function formatMemberDisplayNames(
  entries: MemberNameInput[],
): Record<string, string> {
  const parsed = entries.map((entry) => {
    const tokens = extractNameTokens(entry.email);
    const first = tokens[0] ? capitalizeWord(tokens[0]) : entry.fallback || "";
    const last = tokens.length > 1 ? tokens[tokens.length - 1] : "";
    return {
      userId: entry.user_id,
      first,
      lastInitial: last ? last.charAt(0).toLocaleUpperCase("pl-PL") : "",
      fallback: entry.fallback || "",
    };
  });

  const firstCounts = new Map<string, number>();
  for (const item of parsed) {
    if (!item.first) continue;
    const key = item.first.toLocaleLowerCase("pl-PL");
    firstCounts.set(key, (firstCounts.get(key) ?? 0) + 1);
  }

  const result: Record<string, string> = {};
  for (const item of parsed) {
    if (!item.userId) continue;
    if (!item.first) {
      if (item.fallback) result[item.userId] = item.fallback;
      continue;
    }
    const duplicateFirst =
      (firstCounts.get(item.first.toLocaleLowerCase("pl-PL")) ?? 0) > 1;
    result[item.userId] =
      duplicateFirst && item.lastInitial
        ? `${item.first} ${item.lastInitial}.`
        : item.first;
  }
  return result;
}
