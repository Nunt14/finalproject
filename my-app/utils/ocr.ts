import * as FileSystem from 'expo-file-system/legacy';

export type OcrResult = {
  text: string | null;
  amount: number | null;
  dateString: string | null;
  raw?: unknown;
};

// Try to parse amount/date from free-form OCR text (Thai/English receipts)
export function parsePaymentInfoFromText(text: string): { amount: number | null; dateString: string | null } {
  console.log('[OCR] parsePaymentInfoFromText called with text:', text);
  if (!text) {
    console.log('[OCR] No text provided');
    return { amount: null, dateString: null };
  }
  const normalized = text
    .replace(/\u200b/g, '') // ลบ zero-width space
    .replace(/\u00a0/g, ' ') // แทนที่ non-breaking space ด้วย space ปกติ
    .replace(/\s{2,}/g, ' ') // แทนที่ multiple spaces ด้วย single space
    .replace(/[,，]/g, ',') // แทนที่ comma ต่างๆ
    .replace(/[^\u0E00-\u0E7F\u0020-\u007E\u00A0-\u00FF]/g, ' ') // เก็บเฉพาะตัวอักษรไทย, ASCII, และ Latin-1
    .trim();
  console.log('[OCR] Normalized text:', normalized);

  // Amount heuristics: prefer numbers near Thai/EN keywords; then numbers with currency; then decimals; then any number
  const lines = normalized.split(/\n|\r/).map((l) => l.trim()).filter(Boolean);
  const numberPattern = '(?:\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)';
  const amountRegex = new RegExp(
    `(?:(?:รวมทั้งสิ้น|รวม|ยอดรวม|ยอดเงิน|ยอด|จำนวน|จำนวน:|จำนวนเงิน:|Amount|Total|Paid|Grand\\s*Total|ชำระ|โอนเงิน|จำนวนเงิน)\\s*[:=]?\\s*)(${numberPattern})`,
    'i'
  );
  const bahtRegex = new RegExp(`(${numberPattern})\\s*(?:บาท|THB|฿)`, 'i');
  let candidate: number | null = null;

  const keywordCandidates: number[] = [];
  console.log('[OCR] Processing lines:', lines);
  for (const line of lines) {
    console.log('[OCR] Processing line:', line);
    const m1 = line.match(amountRegex);
    if (m1 && m1[1]) {
      const num = Number(m1[1].replace(/,/g, ''));
      console.log('[OCR] Found amount with keyword:', num);
      if (!Number.isNaN(num)) keywordCandidates.push(num);
    }
    const m2 = line.match(bahtRegex);
    if (m2 && m2[1]) {
      const num = Number(m2[1].replace(/,/g, ''));
      console.log('[OCR] Found amount with currency:', num);
      if (!Number.isNaN(num)) keywordCandidates.push(num);
    }
  }
  console.log('[OCR] Keyword candidates:', keywordCandidates);
  // ถ้ามีผู้สมัครจากบรรทัดที่มีคีย์เวิร์ด: ให้เลือกค่าที่เป็นทศนิยมก่อน ถ้าไม่มีทศนิยมให้เลือกค่าสูงสุด
  if (keywordCandidates.length > 0) {
    const decimalFirst = keywordCandidates.filter((n) => Number.isFinite(n) && Math.abs(n % 1) > 0);
    candidate = (decimalFirst.length > 0 ? Math.max(...decimalFirst) : Math.max(...keywordCandidates));
  }

  if (candidate == null) {
    console.log('[OCR] No keyword candidates, trying fallback 1...');
    // Fallback 1: any "number + currency" anywhere; prefer decimals
    const curMatches = Array.from(normalized.matchAll(new RegExp(`(${numberPattern})\\s*(?:บาท|THB|฿)`, 'gi')))
      .map((m: any) => Number(String(m[1]).replace(/,/g, '')))
      .filter((n: number) => !Number.isNaN(n) && n > 0);
    console.log('[OCR] Currency matches:', curMatches);
    if (curMatches.length > 0) {
      const dec = curMatches.filter((n) => Math.abs(n % 1) > 0);
      candidate = dec.length > 0 ? Math.max(...dec) : Math.max(...curMatches);
      console.log('[OCR] Selected from currency matches:', candidate);
    }
  }

  if (candidate == null) {
    console.log('[OCR] No currency matches, trying fallback 2...');
    // Fallback 2: choose the largest decimal number with boundaries (avoid substrings in long IDs)
    const decRe = /\d{1,3}(?:,\d{3})*\.\d{1,2}|\d+\.\d{1,2}/g;
    const decMatches = Array.from(normalized.matchAll(decRe)) as Array<RegExpMatchArray & { index: number }>;
    console.log('[OCR] Decimal matches found:', decMatches.map(m => m[0]));
    const nums: number[] = [];
    for (const m of decMatches) {
      const val = Number(m[0].replace(/,/g, ''));
      const start = (m as any).index ?? normalized.indexOf(m[0]);
      const end = start + m[0].length;
      const before = normalized[start - 1] ?? ' ';
      const after = normalized[end] ?? ' ';
      const isBoundary = !/\d/.test(before) && !/\d/.test(after);
      console.log('[OCR] Checking decimal:', m[0], 'val:', val, 'isBoundary:', isBoundary);
      if (!Number.isNaN(val) && val > 0 && val < 1e7 && isBoundary) nums.push(val);
    }
    console.log('[OCR] Valid decimal numbers:', nums);
    if (nums.length > 0) candidate = Math.max(...nums);
  }

  // Special case for bank transfer slips: look for amount after "จำนวน:" or "จำนวน"
  if (candidate == null) {
    console.log('[OCR] Trying bank slip specific patterns...');
    const bankAmountRegex = /(?:จำนวน|จำนวน:)\s*(\d+(?:\.\d{1,2})?)\s*(?:บาท|฿)?/i;
    const bankMatch = normalized.match(bankAmountRegex);
    if (bankMatch && bankMatch[1]) {
      const val = Number(bankMatch[1]);
      if (!Number.isNaN(val) && val > 0) {
        candidate = val;
        console.log('[OCR] Found amount from bank slip pattern:', candidate);
      }
    }
  }

  // Additional Thai-specific patterns
  if (candidate == null) {
    console.log('[OCR] Trying additional Thai patterns...');
    const thaiPatterns = [
      /(?:ยอดเงิน|ยอดรวม|รวมทั้งสิ้น|ชำระ|โอนเงิน)\s*[:=]?\s*(\d+(?:\.\d{1,2})?)\s*(?:บาท|฿)?/i,
      /(\d+(?:\.\d{1,2})?)\s*(?:บาท|฿)\s*(?:ยอดเงิน|ยอดรวม|รวมทั้งสิ้น|ชำระ|โอนเงิน)/i,
      /(?:Amount|Total|Paid)\s*[:=]?\s*(\d+(?:\.\d{1,2})?)\s*(?:บาท|฿)?/i,
    ];
    
    for (const pattern of thaiPatterns) {
      const match = normalized.match(pattern);
      if (match && match[1]) {
        const val = Number(match[1]);
        if (!Number.isNaN(val) && val > 0) {
          candidate = val;
          console.log('[OCR] Found amount from Thai pattern:', candidate);
          break;
        }
      }
    }
  }

  // Date heuristics: capture common TH/EN date formats
  const datePatterns = [
    /(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/, // 12/08/2024 or 12-08-24
    /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/,   // 2024-08-12
    /(\d{1,2})\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*(\d{2,4})/i,
    /(\d{1,2})\s+(?:ม\.ค|ก\.พ|มี\.ค|เม\.ย|พ\.ค|มิ\.ย|ก\.ค|ส\.ค|ก\.ย|ต\.ค|พ\.ย|ธ\.ค)\.\s*(\d{2,4})/, // 26 ก.ย. 68
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
    console.log('[OCR] runOcrOnImage called with params:', { hasBase64: !!params.base64, hasLocalUri: !!params.localUri });
    let base64 = params.base64;
    if (!base64 && params.localUri) {
      console.log('[OCR] Converting localUri to base64:', params.localUri);
      // ใช้ FileSystem.readAsStringAsync สำหรับ React Native
      try {
        base64 = await FileSystem.readAsStringAsync(params.localUri, { encoding: 'base64' });
        console.log('[OCR] Successfully converted to base64, length:', base64.length);
      } catch (error) {
        console.error('[OCR] Failed to read file as base64:', error);
        base64 = '';
      }
    }
    if (!base64) {
      console.log('[OCR] No base64 data available');
      return { text: null, amount: null, dateString: null };
    }

    console.log('[OCR] Base64 length:', base64.length);
    console.log('[OCR] Base64 preview:', base64.substring(0, 50) + '...');
    // คีย์ OCR.space
    const apiKey = process.env.EXPO_PUBLIC_OCR_SPACE_KEY || 'helloworld';
    console.log('[OCR] Using API key:', apiKey.substring(0, 8) + '...');
    console.log('[OCR] API key length:', apiKey.length);

    async function callOcr(language: 'tha' | 'eng') {
      console.log('[OCR] Calling OCR API with language:', language);
      const body = new FormData();
      const base64Image = `data:image/jpeg;base64,${base64}`;
      body.append('base64Image', base64Image);
      body.append('language', language);
      body.append('isTable', 'true');
      body.append('scale', 'true');
      body.append('OCREngine', '2'); // เปลี่ยนเป็น engine 2 สำหรับภาษาไทยที่ดีกว่า
      body.append('detectOrientation', 'true'); // ตรวจจับทิศทางข้อความ
      body.append('filetype', 'JPG');
      body.append('apikey', apiKey);
      
      console.log('[OCR] FormData entries:');
      console.log('[OCR] - base64Image length:', base64Image.length);
      console.log('[OCR] - language:', language);
      console.log('[OCR] - apikey:', apiKey.substring(0, 8) + '...');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        console.log('[OCR] Sending request to OCR.space API...');
        const resp = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          body,
          signal: controller.signal as any,
        });
        clearTimeout(timeout);
        console.log('[OCR] API response status:', resp.status);
        console.log('[OCR] API response headers:', Object.fromEntries(resp.headers.entries()));
        const json = await resp.json().catch((error) => {
          console.error('[OCR] Failed to parse JSON response:', error);
          return null;
        });
        console.log('[OCR] API response:', { 
          ok: resp.ok, 
          status: resp.status,
          hasError: json?.IsErroredOnProcessing,
          hasResults: !!json?.ParsedResults?.length,
          errorMessage: json?.ErrorMessage,
          errorDetails: json?.ErrorDetails
        });
        if (!resp.ok) return { ok: false, json } as const;
        return { ok: true, json } as const;
      } catch (e) {
        clearTimeout(timeout);
        console.error('[OCR] API call failed:', e);
        return { ok: false, json: null } as const;
      }
    }

    // ลองภาษาไทยก่อน ถ้าไม่ได้ ค่อย fallback อังกฤษ
    console.log('[OCR] Trying Thai language first...');
    let res = await callOcr('tha');
    if (!res.ok || res.json?.IsErroredOnProcessing) {
      console.log('[OCR] Thai failed, trying English...');
      res = await callOcr('eng');
    }
    
    // หากยังไม่ได้ ลองใช้ mixed language (tha+eng)
    if (!res.ok || res.json?.IsErroredOnProcessing) {
      console.log('[OCR] English failed, trying mixed language...');
      const body = new FormData();
      const base64Image = `data:image/jpeg;base64,${base64}`;
      body.append('base64Image', base64Image);
      body.append('language', 'tha+eng'); // ใช้ mixed language
      body.append('isTable', 'true');
      body.append('scale', 'true');
      body.append('OCREngine', '2');
      body.append('detectOrientation', 'true');
      body.append('filetype', 'JPG');
      body.append('apikey', apiKey);
      
      try {
        const resp = await fetch('https://api.ocr.space/parse/image', {
          method: 'POST',
          body,
        });
        const json = await resp.json().catch(() => null);
        res = { ok: resp.ok, json };
        console.log('[OCR] Mixed language result:', { ok: res.ok, hasError: res.json?.IsErroredOnProcessing });
      } catch (e) {
        console.error('[OCR] Mixed language failed:', e);
      }
    }
    const json: any = res.json;
    console.log('[OCR] Full API response:', JSON.stringify(json, null, 2));
    if (!json || res.ok !== true || json?.IsErroredOnProcessing) {
      console.log('[OCR] OCR failed:', { 
        hasJson: !!json, 
        ok: res.ok, 
        hasError: json?.IsErroredOnProcessing,
        errorMessage: json?.ErrorMessage,
        errorDetails: json?.ErrorDetails
      });
      return { text: null, amount: null, dateString: null, raw: json };
    }

    const parsedText: string | null = json?.ParsedResults?.[0]?.ParsedText ?? null;
    console.log('[OCR] Extracted text length:', parsedText?.length || 0);
    if (parsedText) {
      console.log('[OCR] Text preview:', parsedText.substring(0, 200) + '...');
    }
    
  const { amount, dateString } = parsedText ? parsePaymentInfoFromText(parsedText) : { amount: null, dateString: null };
  console.log('[OCR] Final parsed amount:', amount, 'date:', dateString);
  return { text: parsedText, amount, dateString, raw: json };
  } catch (error) {
    console.error('[OCR] runOcrOnImage error:', error);
    return { text: null, amount: null, dateString: null };
  }
}


