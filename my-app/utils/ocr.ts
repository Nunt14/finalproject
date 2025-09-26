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

  // Amount heuristics: prefer numbers near Thai/EN keywords; then numbers with currency; then decimals; then any number
  const lines = normalized.split(/\n|\r/).map((l) => l.trim()).filter(Boolean);
  const numberPattern = '(?:\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)';
  const amountRegex = new RegExp(
    `(?:(?:รวมทั้งสิ้น|รวม|ยอดรวม|ยอดเงิน|ยอด|จำนวน|จำนวน:|จำนวนเงิน:|Amount|Total|Paid|Grand\\s*Total|ชำระ)\\s*[:=]?\\s*)(${numberPattern})`,
    'i'
  );
  const bahtRegex = new RegExp(`(${numberPattern})\\s*(?:บาท|THB|฿)`, 'i');
  let candidate: number | null = null;

  const keywordCandidates: number[] = [];
  for (const line of lines) {
    const m1 = line.match(amountRegex);
    if (m1 && m1[1]) {
      const num = Number(m1[1].replace(/,/g, ''));
      if (!Number.isNaN(num)) keywordCandidates.push(num);
    }
    const m2 = line.match(bahtRegex);
    if (m2 && m2[1]) {
      const num = Number(m2[1].replace(/,/g, ''));
      if (!Number.isNaN(num)) keywordCandidates.push(num);
    }
  }
  // ถ้ามีผู้สมัครจากบรรทัดที่มีคีย์เวิร์ด: ให้เลือกค่าที่เป็นทศนิยมก่อน ถ้าไม่มีทศนิยมให้เลือกค่าสูงสุด
  if (keywordCandidates.length > 0) {
    const decimalFirst = keywordCandidates.filter((n) => Number.isFinite(n) && Math.abs(n % 1) > 0);
    candidate = (decimalFirst.length > 0 ? Math.max(...decimalFirst) : Math.max(...keywordCandidates));
  }

  if (candidate == null) {
    // Fallback 1: any "number + currency" anywhere; prefer decimals
    const curMatches = Array.from(normalized.matchAll(new RegExp(`(${numberPattern})\\s*(?:บาท|THB|฿)`, 'gi')))
      .map((m: any) => Number(String(m[1]).replace(/,/g, '')))
      .filter((n: number) => !Number.isNaN(n) && n > 0);
    if (curMatches.length > 0) {
      const dec = curMatches.filter((n) => Math.abs(n % 1) > 0);
      candidate = dec.length > 0 ? Math.max(...dec) : Math.max(...curMatches);
    }
  }

  if (candidate == null) {
    // Fallback 2: choose the largest decimal number with boundaries (avoid substrings in long IDs)
    const decRe = /\d{1,3}(?:,\d{3})*\.\d{1,2}|\d+\.\d{1,2}/g;
    const decMatches = Array.from(normalized.matchAll(decRe)) as Array<RegExpMatchArray & { index: number }>;
    const nums: number[] = [];
    for (const m of decMatches) {
      const val = Number(m[0].replace(/,/g, ''));
      const start = (m as any).index ?? normalized.indexOf(m[0]);
      const end = start + m[0].length;
      const before = normalized[start - 1] ?? ' ';
      const after = normalized[end] ?? ' ';
      const isBoundary = !/\d/.test(before) && !/\d/.test(after);
      if (!Number.isNaN(val) && val > 0 && val < 1e7 && isBoundary) nums.push(val);
    }
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

    // ใช้คีย์จาก env หรือคีย์ตัวอย่างของ OCR.space สำหรับทดสอบ (มี rate limit สูง)
    const apiKey = process.env.EXPO_PUBLIC_OCR_SPACE_KEY || 'helloworld';
    const body = new FormData();
    body.append('base64Image', `data:image/jpeg;base64,${base64}`);
    // OCR.space ไม่รองรับการส่งหลายภาษาแบบคอมมา ใช้ 'eng' เพื่ออ่านตัวเลข/คำอังกฤษบนสลิป
    body.append('language', 'eng');
    body.append('isTable', 'true');
    body.append('scale', 'true');
    body.append('apikey', apiKey);

    // ตั้ง timeout กันค้าง
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let json: any = null;
    try {
      const resp = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body,
        signal: controller.signal as any,
      });
      clearTimeout(timeout);
      try { json = await resp.json(); } catch { json = null; }
      if (!resp.ok) {
        console.warn('[OCR] HTTP error', resp.status, json);
        return { text: null, amount: null, dateString: null, raw: json };
      }
    } catch (e) {
      clearTimeout(timeout);
      console.warn('[OCR] network/timeout error', String(e));
      return { text: null, amount: null, dateString: null };
    }

    // ตรวจผลจาก OCR.space
    const isError = json?.IsErroredOnProcessing || (typeof json?.OCRExitCode === 'number' && json.OCRExitCode !== 1);
    if (isError) {
      console.warn('[OCR] api error', json?.ErrorMessage || json);
      return { text: null, amount: null, dateString: null, raw: json };
    }

    const parsedText: string | null = json?.ParsedResults?.[0]?.ParsedText ?? null;
    const { amount, dateString } = parsedText ? parsePaymentInfoFromText(parsedText) : { amount: null, dateString: null };
    return { text: parsedText, amount, dateString, raw: json };
  } catch {
    return { text: null, amount: null, dateString: null };
  }
}


