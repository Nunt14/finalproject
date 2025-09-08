import * as FileSystem from 'expo-file-system';

export type OcrResult = {
  text: string | null;
  amount: number | null;
  dateString: string | null;
  raw?: unknown;
};

// Try to parse amount/date from free-form OCR text (Thai/English receipts)
export function parsePaymentInfoFromText(text: string): { amount: number | null; dateString: string | null } {
  if (!text) return { amount: null, dateString: null };
  const normalized = text
    .replace(/\u200b/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[,，]/g, ',')
    .trim();

  // Amount heuristics: prefer lines with keywords, fallback to largest currency-like number
  const lines = normalized.split(/\n|\r/).map((l) => l.trim()).filter(Boolean);
  const amountRegex = /(?:(?:รวม|ยอด|Amount|Total|ชำระ)\s*[:=]?\s*)(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i;
  let candidate: number | null = null;

  for (const line of lines) {
    const m = line.match(amountRegex);
    if (m && m[1]) {
      const num = Number(m[1].replace(/,/g, ''));
      if (!Number.isNaN(num)) {
        candidate = num;
        break;
      }
    }
  }

  if (candidate == null) {
    // Fallback: scan all numbers and pick the max with 2 decimals or thousands grouping
    const nums = Array.from(normalized.matchAll(/\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+\.\d{1,2}/g)).map((m) =>
      Number(m[0].replace(/,/g, ''))
    );
    if (nums.length > 0) candidate = Math.max(...nums);
  }

  // Date heuristics: capture common TH/EN date formats
  const datePatterns = [
    /(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/, // 12/08/2024 or 12-08-24
    /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/,   // 2024-08-12
    /(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{2,4})/i,
  ];
  let dateString: string | null = null;
  for (const re of datePatterns) {
    const m = normalized.match(re);
    if (m) {
      dateString = m[0];
      break;
    }
  }

  return { amount: candidate, dateString };
}

// Perform OCR via OCR.space API using base64 image. Requires EXPO_PUBLIC_OCR_SPACE_KEY.
// Language set to Thai + English for mixed slips.
export async function runOcrOnImage(params: { base64?: string; localUri?: string }): Promise<OcrResult> {
  try {
    let base64 = params.base64;
    if (!base64 && params.localUri) {
      base64 = await FileSystem.readAsStringAsync(params.localUri, { encoding: FileSystem.EncodingType.Base64 });
    }
    if (!base64) return { text: null, amount: null, dateString: null };

    const apiKey = process.env.EXPO_PUBLIC_OCR_SPACE_KEY || '';
    const body = new FormData();
    body.append('base64Image', `data:image/jpeg;base64,${base64}`);
    body.append('language', 'tha,eng');
    body.append('isTable', 'true');
    body.append('scale', 'true');
    if (apiKey) body.append('apikey', apiKey);

    const resp = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body,
    });
    const json = await resp.json();
    const parsedText: string | null = json?.ParsedResults?.[0]?.ParsedText ?? null;
    const { amount, dateString } = parsedText ? parsePaymentInfoFromText(parsedText) : { amount: null, dateString: null };
    return { text: parsedText, amount, dateString, raw: json };
  } catch {
    return { text: null, amount: null, dateString: null };
  }
}


