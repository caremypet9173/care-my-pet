let cachedAssets = null;

export async function loadBrowserPdfAssets() {
  if (cachedAssets) return cachedAssets;
  const [regRes, boldRes, logoRes] = await Promise.all([
    fetch("/fonts/Inter-Regular.ttf"),
    fetch("/fonts/Inter-Bold.ttf"),
    fetch("/brand/icon-192.png").catch(() => null),
  ]);
  if (!regRes.ok || !boldRes.ok) {
    throw new Error("Nie udało się wczytać czcionek do wygenerowania pliku PDF.");
  }
  const [regBuf, boldBuf, logoBuf] = await Promise.all([
    regRes.arrayBuffer(),
    boldRes.arrayBuffer(),
    logoRes?.ok ? logoRes.arrayBuffer() : Promise.resolve(null),
  ]);
  cachedAssets = {
    regular: new Uint8Array(regBuf),
    bold: new Uint8Array(boldBuf),
    logoPng: logoBuf ? new Uint8Array(logoBuf) : undefined,
  };
  return cachedAssets;
}

/** Strips characters unsupported by the embedded TTF font so pdf-lib never throws during text encoding. */
export function safeTextForFont(font, raw, fontSize) {
  const cleaned = String(raw ?? "").replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  try {
    font.widthOfTextAtSize(cleaned, fontSize);
    return cleaned;
  } catch {
    let out = "";
    for (const ch of cleaned) {
      try {
        font.widthOfTextAtSize(ch, fontSize);
        out += ch;
      } catch {
        // Ignore unsupported emoji/symbol glyph
      }
    }
    return out.trim();
  }
}

/** Wraps a single paragraph into lines that fit inside maxWidth. */
export function wrapText(font, text, fontSize, maxWidth) {
  const safe = safeTextForFont(font, text, fontSize);
  if (!safe) return [];

  const words = safe.split(" ");
  const lines = [];
  let current = "";

  const pushLongWord = (word) => {
    let chunk = "";
    for (const ch of word) {
      const candidate = chunk + ch;
      if (chunk && font.widthOfTextAtSize(candidate, fontSize) > maxWidth) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = candidate;
      }
    }
    if (chunk) current = chunk;
  };

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) {
      lines.push(current);
      current = "";
    }
    if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
      current = word;
    } else {
      pushLongWord(word);
    }
  }

  if (current) lines.push(current);
  return lines;
}
