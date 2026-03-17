import { type SystemSettings, type Donor } from '@/db/database';

/**
 * MASAV Debit File Generator (חיובים / Get Payments)
 * Based on official MASAV specification: Mifrat Hiuvim MSV
 * 
 * Record length: 128 bytes (Windows-1255 encoding) + CR LF (positions 129-130)
 * Encoding: Windows-1255 (1 byte per Hebrew character)
 * 
 * File structure:
 * - Header record (K) - first record
 * - Movement records (1) - N records  
 * - Totals record (5) - last record
 * - End record (999...9) - 128 nines
 */

// ─── Windows-1255 Encoding Map ───────────────────────────────────────
const HEBREW_TO_WIN1255: Record<string, number> = {};
for (let i = 0; i <= 26; i++) {
  HEBREW_TO_WIN1255[String.fromCharCode(0x05D0 + i)] = 0xE0 + i;
}
HEBREW_TO_WIN1255['־'] = 0x2D;
HEBREW_TO_WIN1255['׳'] = 0x27;
HEBREW_TO_WIN1255['״'] = 0x22;

export function encodeWin1255(str: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = ch.charCodeAt(0);
    if (HEBREW_TO_WIN1255[ch] !== undefined) {
      bytes.push(HEBREW_TO_WIN1255[ch]);
    } else if (code <= 0x7F) {
      bytes.push(code);
    } else {
      bytes.push(0x20);
    }
  }
  return new Uint8Array(bytes);
}

// ─── Field Formatting Helpers ────────────────────────────────────────

export function padRight(str: string, len: number, char = ' '): string {
  const s = (str || '').slice(0, len);
  return s + char.repeat(Math.max(0, len - s.length));
}

export function padLeft(str: string, len: number, char = '0'): string {
  const s = (str || '').slice(0, len);
  return char.repeat(Math.max(0, len - s.length)) + s;
}

export function formatAmountTransaction(amount: number): string {
  const totalAgorot = Math.round(Math.abs(amount) * 100);
  const shekel = Math.floor(totalAgorot / 100);
  const agorot = totalAgorot % 100;
  return padLeft(shekel.toString(), 11) + padLeft(agorot.toString(), 2);
}

export function formatAmountSummary(amount: number): string {
  const totalAgorot = Math.round(Math.abs(amount) * 100);
  const shekel = Math.floor(totalAgorot / 100);
  const agorot = totalAgorot % 100;
  return padLeft(shekel.toString(), 13) + padLeft(agorot.toString(), 2);
}

export function formatDateYYMMDD(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) throw new Error(`תאריך לא חוקי: ${dateStr}`);
  const yy = d.getFullYear().toString().slice(-2);
  const mm = padLeft((d.getMonth() + 1).toString(), 2);
  const dd = padLeft(d.getDate().toString(), 2);
  return yy + mm + dd;
}

function getCurrentYYMM(): string {
  const d = new Date();
  const yy = d.getFullYear().toString().slice(-2);
  const mm = padLeft((d.getMonth() + 1).toString(), 2);
  return yy + mm;
}

// ─── Interfaces ──────────────────────────────────────────────────────

export interface MasavValidationError {
  donorName: string;
  donorId: number;
  errors: string[];
}

export interface MasavPreviewRecord {
  type: 'header' | 'transaction' | 'summary';
  raw: string;
  fields: Record<string, string>;
}

export interface DryRunResult {
  valid: boolean;
  totalRecords: number;
  totalAmount: number;
  duplicates: { donorName: string; accountNumber: string }[];
  validationErrors: MasavValidationError[];
  integrityErrors: string[];
  fileSize: number;
  records: MasavPreviewRecord[];
}

// ─── Israeli ID Validation (Luhn mod 10) ─────────────────────────────

export function validateIsraeliId(id: string): boolean {
  if (!id || !/^\d{1,9}$/.test(id)) return false;
  const padded = id.padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let val = parseInt(padded[i]) * ((i % 2) + 1);
    if (val > 9) val -= 9;
    sum += val;
  }
  return sum % 10 === 0;
}

// ─── Israeli Bank Account Validation ─────────────────────────────────

export function validateBankNumber(bankNumber: string): boolean {
  if (!bankNumber) return false;
  const num = parseInt(bankNumber, 10);
  return !isNaN(num) && num >= 1 && num <= 99 && /^\d{1,2}$/.test(bankNumber);
}

export function validateBranchNumber(branchNumber: string): boolean {
  if (!branchNumber) return false;
  const num = parseInt(branchNumber, 10);
  return !isNaN(num) && num >= 1 && num <= 999 && /^\d{1,3}$/.test(branchNumber);
}

export function validateAccountNumber(accountNumber: string): boolean {
  if (!accountNumber) return false;
  return /^\d{1,9}$/.test(accountNumber) && parseInt(accountNumber, 10) > 0;
}

// ─── Duplicate Detection ─────────────────────────────────────────────

export function findDuplicates(donors: Donor[]): { donorName: string; accountNumber: string }[] {
  const seen = new Map<string, string>();
  const duplicates: { donorName: string; accountNumber: string }[] = [];
  
  for (const donor of donors) {
    const key = `${donor.bankNumber}-${donor.branchNumber}-${donor.accountNumber}`;
    if (seen.has(key)) {
      duplicates.push({
        donorName: `${donor.fullName} (כפילות עם ${seen.get(key)})`,
        accountNumber: key,
      });
    } else {
      seen.set(key, donor.fullName);
    }
  }
  return duplicates;
}

// ─── Comprehensive Validation ────────────────────────────────────────

export function validateDonorsForMasav(
  settings: SystemSettings,
  donors: Donor[]
): MasavValidationError[] {
  const errors: MasavValidationError[] = [];

  // Settings validation
  const settingsErrors: string[] = [];
  if (!settings.masvInstitutionNumber || !/^\d{1,8}$/.test(settings.masvInstitutionNumber)) {
    settingsErrors.push('מספר מוסד מס"ב חייב להיות עד 8 ספרות');
  }
  if (!settings.sendingInstitutionNumber && !settings.masvInstitutionNumber) {
    settingsErrors.push('מספר מוסד שולח חייב להיות מוגדר');
  }
  if (!settings.organizationName || settings.organizationName.trim().length === 0) {
    settingsErrors.push('שם הארגון חייב להיות מוגדר');
  }
  if (settingsErrors.length > 0) {
    errors.push({ donorName: 'הגדרות מערכת', donorId: 0, errors: settingsErrors });
  }

  // Per-donor validation
  for (const donor of donors) {
    const donorErrors: string[] = [];

    if (!validateBankNumber(donor.bankNumber)) {
      donorErrors.push('מספר בנק לא תקין (1-2 ספרות, 1-99)');
    }
    if (!validateBranchNumber(donor.branchNumber)) {
      donorErrors.push('מספר סניף לא תקין (1-3 ספרות, 1-999)');
    }
    if (!validateAccountNumber(donor.accountNumber)) {
      donorErrors.push('מספר חשבון לא תקין (1-9 ספרות, גדול מ-0)');
    }
    if (!donor.monthlyAmount || donor.monthlyAmount <= 0) {
      donorErrors.push('סכום חיוב חייב להיות גדול מ-0');
    }
    if (donor.monthlyAmount > 99999999999.99) {
      donorErrors.push('סכום חורג מהמקסימום המותר (₪99,999,999,999.99)');
    }
    if (!donor.idNumber || !/^\d{1,9}$/.test(donor.idNumber)) {
      donorErrors.push('מספר זהות חייב להכיל 1-9 ספרות');
    } else if (!validateIsraeliId(donor.idNumber)) {
      donorErrors.push('מספר זהות לא עובר בדיקת ספרת ביקורת');
    }
    if (!donor.fullName || donor.fullName.trim().length === 0) {
      donorErrors.push('שם מלא חייב להיות מוגדר');
    }

    if (donorErrors.length > 0) {
      errors.push({
        donorName: donor.fullName || `תורם #${donor.id}`,
        donorId: donor.id || 0,
        errors: donorErrors,
      });
    }
  }

  return errors;
}

// ─── Date Validation ─────────────────────────────────────────────────

export function validateCollectionDate(dateStr: string): string[] {
  const errors: string[] = [];
  if (!dateStr) {
    errors.push('תאריך גבייה חובה');
    return errors;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    errors.push('תאריך לא חוקי');
    return errors;
  }
  // Can't be more than 60 days in the past
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  if (d < sixtyDaysAgo) {
    errors.push('תאריך גבייה ישן מדי (מעל 60 יום אחורה)');
  }
  // Can't be more than 90 days in the future
  const ninetyDaysAhead = new Date();
  ninetyDaysAhead.setDate(ninetyDaysAhead.getDate() + 90);
  if (d > ninetyDaysAhead) {
    errors.push('תאריך גבייה רחוק מדי (מעל 90 יום קדימה)');
  }
  return errors;
}

// ─── Record Builders ─────────────────────────────────────────────────

export function buildHeaderRecord(settings: SystemSettings, collectionDate: string): string {
  let rec = '';
  rec += 'K';
  rec += padLeft(settings.masvInstitutionNumber, 8);
  rec += '00';
  rec += formatDateYYMMDD(collectionDate);
  rec += '0';
  rec += '001';
  rec += '0';
  rec += formatDateYYMMDD(new Date().toISOString());
  const sendingInst = settings.sendingInstitutionNumber || settings.masvInstitutionNumber;
  rec += padLeft(sendingInst, 5);
  rec += '000000';
  rec += padRight(settings.organizationName, 30);
  rec += padRight('', 56);
  rec += 'KOT';
  
  if (rec.length > 128) rec = rec.slice(0, 128);
  if (rec.length < 128) rec = rec + ' '.repeat(128 - rec.length);
  return rec;
}

export function buildTransactionRecord(settings: SystemSettings, donor: Donor, _collectionDate: string): string {
  const period = getCurrentYYMM();
  
  let rec = '';
  rec += '1';
  rec += padLeft(settings.masvInstitutionNumber, 8);
  rec += '00';
  rec += '000000';
  rec += padLeft(donor.bankNumber, 2);
  rec += padLeft(donor.branchNumber, 3);
  rec += '0000';
  rec += padLeft(donor.accountNumber, 9);
  rec += '0';
  rec += padLeft(donor.idNumber || '0', 9);
  rec += padRight(donor.fullName, 16);
  rec += formatAmountTransaction(donor.monthlyAmount);
  rec += padLeft(donor.authorizationNumber || '', 20);
  rec += period + period;
  rec += '000';
  rec += '504';
  rec += padLeft('', 18, '0');
  rec += '  ';
  
  if (rec.length > 128) rec = rec.slice(0, 128);
  if (rec.length < 128) rec = rec + ' '.repeat(128 - rec.length);
  return rec;
}

export function buildSummaryRecord(
  settings: SystemSettings,
  collectionDate: string,
  totalAmount: number,
  recordCount: number
): string {
  let rec = '';
  rec += '5';
  rec += padLeft(settings.masvInstitutionNumber, 8);
  rec += '00';
  rec += formatDateYYMMDD(collectionDate);
  rec += '0';
  rec += '001';
  rec += padLeft('', 15, '0');
  rec += formatAmountSummary(totalAmount);
  rec += padLeft('', 7, '0');
  rec += padLeft(recordCount.toString(), 7, '0');
  rec += padRight('', 63);
  
  if (rec.length > 128) rec = rec.slice(0, 128);
  if (rec.length < 128) rec = rec + ' '.repeat(128 - rec.length);
  return rec;
}

// ─── File Integrity Check ────────────────────────────────────────────

export function verifyFileIntegrity(lines: string[], donors: Donor[], expectedTotal: number): string[] {
  const errors: string[] = [];
  
  // Check record count: header + N transactions + summary + end = N + 3
  const expectedLines = donors.length + 3;
  if (lines.length !== expectedLines) {
    errors.push(`מספר רשומות שגוי: צפוי ${expectedLines}, נמצא ${lines.length}`);
  }
  
  // Check all records are 128 chars
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length !== 128) {
      errors.push(`רשומה ${i + 1} באורך ${lines[i].length} במקום 128 תווים`);
    }
  }
  
  // Check header starts with K
  if (lines.length > 0 && lines[0][0] !== 'K') {
    errors.push('רשומת כותרת לא מתחילה ב-K');
  }
  
  // Check all transaction records start with '1'
  for (let i = 1; i < lines.length - 2; i++) {
    if (lines[i][0] !== '1') {
      errors.push(`רשומת תנועה ${i} לא מתחילה ב-1`);
    }
  }
  
  // Check summary record starts with '5'
  if (lines.length >= 2 && lines[lines.length - 2][0] !== '5') {
    errors.push('רשומת סיכום לא מתחילה ב-5');
  }
  
  // Check end record is all 9s
  if (lines.length >= 1 && lines[lines.length - 1] !== '9'.repeat(128)) {
    errors.push('רשומת סיום לא תקינה');
  }
  
  // Verify summary amount matches sum of transactions
  if (lines.length >= 2) {
    const summaryLine = lines[lines.length - 2];
    const summaryAmountStr = summaryLine.substring(36, 51); // pos 37-51 (0-indexed: 36-50)
    const summaryAmount = parseInt(summaryAmountStr, 10) / 100;
    const expectedAgorot = Math.round(expectedTotal * 100) / 100;
    if (Math.abs(summaryAmount - expectedAgorot) > 0.01) {
      errors.push(`סכום סיכום (₪${summaryAmount.toLocaleString()}) לא תואם סכום תנועות (₪${expectedAgorot.toLocaleString()})`);
    }
    
    // Verify record count in summary
    const summaryCountStr = summaryLine.substring(58, 65); // pos 59-65
    const summaryCount = parseInt(summaryCountStr, 10);
    if (summaryCount !== donors.length) {
      errors.push(`מספר תנועות בסיכום (${summaryCount}) לא תואם מספר תורמים (${donors.length})`);
    }
  }
  
  return errors;
}

// ─── Dry Run ─────────────────────────────────────────────────────────

export function dryRun(
  settings: SystemSettings,
  donors: Donor[],
  collectionDate: string
): DryRunResult {
  const validationErrors = validateDonorsForMasav(settings, donors);
  const duplicates = findDuplicates(donors);
  const dateErrors = validateCollectionDate(collectionDate);
  
  if (dateErrors.length > 0) {
    validationErrors.push({
      donorName: 'תאריך גבייה',
      donorId: 0,
      errors: dateErrors,
    });
  }
  
  const totalAmount = donors.reduce((sum, d) => sum + d.monthlyAmount, 0);
  
  // Build records for preview
  const records: MasavPreviewRecord[] = [];
  const lines: string[] = [];
  
  try {
    const headerLine = buildHeaderRecord(settings, collectionDate);
    lines.push(headerLine);
    records.push({
      type: 'header',
      raw: headerLine,
      fields: {
        'סוג רשומה': 'K - כותרת',
        'מספר מוסד': padLeft(settings.masvInstitutionNumber, 8),
        'מטבע': '00 (שקל)',
        'תאריך תשלום': collectionDate,
        'תאריך יצירה': new Date().toISOString().split('T')[0],
        'שם מוסד': settings.organizationName,
      },
    });
    
    for (const donor of donors) {
      const txLine = buildTransactionRecord(settings, donor, collectionDate);
      lines.push(txLine);
      records.push({
        type: 'transaction',
        raw: txLine,
        fields: {
          'סוג רשומה': '1 - חיוב',
          'שם': donor.fullName,
          'בנק': padLeft(donor.bankNumber, 2),
          'סניף': padLeft(donor.branchNumber, 3),
          'חשבון': padLeft(donor.accountNumber, 9),
          'ת.ז.': padLeft(donor.idNumber, 9),
          'סכום': `₪${donor.monthlyAmount.toLocaleString()}`,
          'סוג תנועה': '504 (חיוב)',
        },
      });
    }
    
    const summaryLine = buildSummaryRecord(settings, collectionDate, totalAmount, donors.length);
    lines.push(summaryLine);
    records.push({
      type: 'summary',
      raw: summaryLine,
      fields: {
        'סוג רשומה': '5 - סיכום',
        'סה"כ חיובים': `₪${totalAmount.toLocaleString()}`,
        'מספר תנועות': donors.length.toString(),
      },
    });
    
    lines.push('9'.repeat(128));
  } catch {
    // If build fails, we still return the partial result
  }
  
  const integrityErrors = lines.length > 0 ? verifyFileIntegrity(lines, donors, totalAmount) : ['שגיאה ביצירת הקובץ'];
  
  // Estimate file size: 128 bytes per record + 2 bytes CRLF between records
  const fileSize = lines.length * 128 + (lines.length - 1) * 2;
  
  const hasErrors = validationErrors.length > 0 || duplicates.length > 0 || integrityErrors.length > 0;
  
  return {
    valid: !hasErrors,
    totalRecords: donors.length,
    totalAmount,
    duplicates,
    validationErrors,
    integrityErrors,
    fileSize,
    records,
  };
}

// ─── Public API ──────────────────────────────────────────────────────

export function generateMasavPreview(
  settings: SystemSettings,
  donors: Donor[],
  collectionDate: string
): MasavPreviewRecord[] {
  return dryRun(settings, donors, collectionDate).records;
}

export function generateMasavBlob(
  settings: SystemSettings,
  donors: Donor[],
  collectionDate: string
): Blob {
  const lines: string[] = [];

  lines.push(buildHeaderRecord(settings, collectionDate));

  let totalAmount = 0;
  for (const donor of donors) {
    lines.push(buildTransactionRecord(settings, donor, collectionDate));
    totalAmount += donor.monthlyAmount;
  }

  lines.push(buildSummaryRecord(settings, collectionDate, totalAmount, donors.length));
  lines.push('9'.repeat(128));

  // Integrity check before export
  const integrityErrors = verifyFileIntegrity(lines, donors, totalAmount);
  if (integrityErrors.length > 0) {
    throw new Error(`שגיאות תקינות בקובץ:\n${integrityErrors.join('\n')}`);
  }

  const encodedLines: Uint8Array[] = lines.map(line => encodeWin1255(line));
  const crlf = new Uint8Array([0x0D, 0x0A]);
  
  let totalSize = 0;
  for (let i = 0; i < encodedLines.length; i++) {
    totalSize += encodedLines[i].length;
    if (i < encodedLines.length - 1) totalSize += 2;
  }
  
  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (let i = 0; i < encodedLines.length; i++) {
    result.set(encodedLines[i], offset);
    offset += encodedLines[i].length;
    if (i < encodedLines.length - 1) {
      result.set(crlf, offset);
      offset += 2;
    }
  }

  return new Blob([result], { type: 'application/octet-stream' });
}

export function generateMasavFile(
  settings: SystemSettings,
  donors: Donor[],
  collectionDate: string
): string {
  const lines: string[] = [];
  lines.push(buildHeaderRecord(settings, collectionDate));
  let totalAmount = 0;
  for (const donor of donors) {
    lines.push(buildTransactionRecord(settings, donor, collectionDate));
    totalAmount += donor.monthlyAmount;
  }
  lines.push(buildSummaryRecord(settings, collectionDate, totalAmount, donors.length));
  lines.push('9'.repeat(128));
  return lines.join('\r\n');
}
