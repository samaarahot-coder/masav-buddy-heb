import { type SystemSettings, type Donor } from '@/db/database';

/**
 * MASAV File Generator - Based on official MASAV specification
 * Source: Bank Leumi / ACH (Automated Clearing House) technical spec
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
// Hebrew letters א-ת map to 0xE0-0xFA in Windows-1255
const HEBREW_TO_WIN1255: Record<string, number> = {};
for (let i = 0; i <= 26; i++) {
  HEBREW_TO_WIN1255[String.fromCharCode(0x05D0 + i)] = 0xE0 + i;
}
// Additional characters
HEBREW_TO_WIN1255['־'] = 0x2D; // Hebrew maqaf → hyphen
HEBREW_TO_WIN1255['׳'] = 0x27; // Hebrew geresh → apostrophe
HEBREW_TO_WIN1255['״'] = 0x22; // Hebrew gershayim → quote

/**
 * Encode a JavaScript string to Windows-1255 bytes
 */
function encodeWin1255(str: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const code = ch.charCodeAt(0);
    
    if (HEBREW_TO_WIN1255[ch] !== undefined) {
      bytes.push(HEBREW_TO_WIN1255[ch]);
    } else if (code <= 0x7F) {
      // Standard ASCII
      bytes.push(code);
    } else {
      // Unknown character → space
      bytes.push(0x20);
    }
  }
  return new Uint8Array(bytes);
}

// ─── Field Formatting Helpers ────────────────────────────────────────

function padRight(str: string, len: number, char = ' '): string {
  const s = (str || '').slice(0, len);
  return s + char.repeat(Math.max(0, len - s.length));
}

function padLeft(str: string, len: number, char = '0'): string {
  const s = (str || '').slice(0, len);
  return char.repeat(Math.max(0, len - s.length)) + s;
}

function formatAmount(amount: number): string {
  // 13 chars total: 11 shekel digits + 2 agorot digits
  const agorot = Math.round(Math.abs(amount) * 100);
  return padLeft(agorot.toString(), 13, '0');
}

function formatDateYYMMDD(dateStr: string): string {
  const d = new Date(dateStr);
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

// ─── Validation ──────────────────────────────────────────────────────

export function validateDonorsForMasav(
  settings: SystemSettings,
  donors: Donor[]
): MasavValidationError[] {
  const errors: MasavValidationError[] = [];

  if (!settings.masvInstitutionNumber || !/^\d{1,8}$/.test(settings.masvInstitutionNumber)) {
    errors.push({
      donorName: 'הגדרות מערכת',
      donorId: 0,
      errors: ['מספר מוסד מס"ב חייב להיות עד 8 ספרות'],
    });
  }

  if (!settings.sendingInstitutionNumber && !settings.masvInstitutionNumber) {
    errors.push({
      donorName: 'הגדרות מערכת',
      donorId: 0,
      errors: ['מספר מוסד שולח חייב להיות מוגדר'],
    });
  }

  for (const donor of donors) {
    const donorErrors: string[] = [];

    if (!donor.bankNumber || !/^\d{1,2}$/.test(donor.bankNumber)) {
      donorErrors.push('מספר בנק חייב להיות 1-2 ספרות');
    }
    if (!donor.branchNumber || !/^\d{1,3}$/.test(donor.branchNumber)) {
      donorErrors.push('מספר סניף חייב להיות 1-3 ספרות');
    }
    if (!donor.accountNumber || !/^\d{1,9}$/.test(donor.accountNumber)) {
      donorErrors.push('מספר חשבון חייב להכיל ספרות בלבד (עד 9)');
    }
    if (!donor.monthlyAmount || donor.monthlyAmount <= 0) {
      donorErrors.push('סכום חייב להיות גדול מאפס');
    }
    if (donor.monthlyAmount > 99999999999.99) {
      donorErrors.push('סכום חורג מהמקסימום המותר');
    }
    if (!donor.idNumber || !/^\d{1,9}$/.test(donor.idNumber)) {
      donorErrors.push('מספר זהות חייב להכיל ספרות בלבד (עד 9)');
    }

    if (donorErrors.length > 0) {
      errors.push({
        donorName: donor.fullName,
        donorId: donor.id || 0,
        errors: donorErrors,
      });
    }
  }

  return errors;
}

// ─── Record Builders ─────────────────────────────────────────────────

/**
 * Header Record (K) - Spec section 3.1
 * 
 * Pos 1     (1)  Record ID = 'K'
 * Pos 2-9   (8)  Institution/subject code
 * Pos 10-11 (2)  Currency = '00'
 * Pos 12-17 (6)  Date of payment YYMMDD
 * Pos 18    (1)  Filler = '0'
 * Pos 19-21 (3)  Serial number = '001'
 * Pos 22    (1)  Filler = '0'
 * Pos 23-28 (6)  Date tape created YYMMDD
 * Pos 29-33 (5)  Sending institution number
 * Pos 34-39 (6)  Filler = zeros
 * Pos 40-69 (30) Name of institution
 * Pos 70-125(56) Filler = blanks
 * Pos 126-128(3) Header ID = 'KOT'
 */
function buildHeaderRecord(settings: SystemSettings, collectionDate: string): string {
  let rec = '';
  rec += 'K';                                                          // 1:   Record ID
  rec += padLeft(settings.masvInstitutionNumber, 8);                   // 2-9: Institution
  rec += '00';                                                         // 10-11: Currency
  rec += formatDateYYMMDD(collectionDate);                             // 12-17: Payment date
  rec += '0';                                                          // 18: Filler
  rec += '001';                                                        // 19-21: Serial
  rec += '0';                                                          // 22: Filler
  rec += formatDateYYMMDD(new Date().toISOString());                   // 23-28: Creation date
  const sendingInst = settings.sendingInstitutionNumber || settings.masvInstitutionNumber;
  rec += padLeft(sendingInst, 5);                                      // 29-33: Sending institution
  rec += '000000';                                                     // 34-39: Filler
  rec += padRight(settings.organizationName, 30);                      // 40-69: Name
  rec += padRight('', 56);                                             // 70-125: Filler
  rec += 'KOT';                                                        // 126-128: Header ID
  
  // Ensure exactly 128 chars
  if (rec.length > 128) rec = rec.slice(0, 128);
  if (rec.length < 128) rec = rec + ' '.repeat(128 - rec.length);
  return rec;
}

/**
 * Movement Record (1) - Spec section 3.2
 * 
 * Pos 1     (1)  Record ID = '1'
 * Pos 2-9   (8)  Institution/subject
 * Pos 10-11 (2)  Currency = '00'
 * Pos 12-17 (6)  Filler = '000000'
 * Pos 18-19 (2)  Bank code
 * Pos 20-22 (3)  Branch number
 * Pos 23-26 (4)  Account type = '0000'
 * Pos 27-35 (9)  Account number
 * Pos 36    (1)  Filler = '0'
 * Pos 37-45 (9)  ID number
 * Pos 46-61 (16) Name of entitled
 * Pos 62-74 (13) Sum for payment (11 shekel + 2 agorot, must be > 0)
 * Pos 75-94 (20) Reference/ID of institution entitled
 * Pos 95-102(8)  Payment period (YYMM from YYMM)
 * Pos 103-105(3) Text code = '000'
 * Pos 106-108(3) Movement type = '006' (regular credit)
 * Pos 109-126(18) Filler = zeros
 * Pos 127-128(2) Filler = blanks
 */
function buildTransactionRecord(settings: SystemSettings, donor: Donor, collectionDate: string): string {
  const period = getCurrentYYMM();
  
  let rec = '';
  rec += '1';                                                          // 1: Record ID
  rec += padLeft(settings.masvInstitutionNumber, 8);                   // 2-9: Institution
  rec += '00';                                                         // 10-11: Currency
  rec += '000000';                                                     // 12-17: Filler
  rec += padLeft(donor.bankNumber, 2);                                 // 18-19: Bank
  rec += padLeft(donor.branchNumber, 3);                               // 20-22: Branch
  rec += '0000';                                                       // 23-26: Account type
  rec += padLeft(donor.accountNumber, 9);                              // 27-35: Account
  rec += '0';                                                          // 36: Filler
  rec += padLeft(donor.idNumber || '0', 9);                            // 37-45: ID
  rec += padRight(donor.fullName, 16);                                 // 46-61: Name
  rec += formatAmount(donor.monthlyAmount);                            // 62-74: Amount
  rec += padLeft(donor.authorizationNumber || '', 20);                 // 75-94: Reference
  rec += period + period;                                              // 95-102: Period
  rec += '000';                                                        // 103-105: Text code
  rec += '006';                                                        // 106-108: Movement type
  rec += padLeft('', 18, '0');                                         // 109-126: Filler
  rec += '  ';                                                         // 127-128: Filler
  
  if (rec.length > 128) rec = rec.slice(0, 128);
  if (rec.length < 128) rec = rec + ' '.repeat(128 - rec.length);
  return rec;
}

/**
 * Totals Record (5) - Spec section 3.3
 * 
 * Pos 1     (1)  Record ID = '5'
 * Pos 2-9   (8)  Institution/subject
 * Pos 10-11 (2)  Currency = '00'
 * Pos 12-17 (6)  Date of payment YYMMDD
 * Pos 18    (1)  Filler = '0'
 * Pos 19-21 (3)  Serial number = '001'
 * Pos 22-36 (15) Sum of movements (in agorot)
 * Pos 37-51 (15) Filler = zeros
 * Pos 52-58 (7)  Number of movements
 * Pos 59-65 (7)  Filler = zeros
 * Pos 66-128(63) Filler = blanks
 */
function buildSummaryRecord(
  settings: SystemSettings,
  collectionDate: string,
  totalAmount: number,
  recordCount: number
): string {
  let rec = '';
  rec += '5';                                                          // 1: Record ID
  rec += padLeft(settings.masvInstitutionNumber, 8);                   // 2-9: Institution
  rec += '00';                                                         // 10-11: Currency
  rec += formatDateYYMMDD(collectionDate);                             // 12-17: Payment date
  rec += '0';                                                          // 18: Filler
  rec += '001';                                                        // 19-21: Serial
  rec += padLeft(Math.round(totalAmount * 100).toString(), 15, '0');   // 22-36: Total amount
  rec += padLeft('', 15, '0');                                         // 37-51: Filler
  rec += padLeft(recordCount.toString(), 7, '0');                      // 52-58: Count
  rec += padLeft('', 7, '0');                                          // 59-65: Filler
  rec += padRight('', 63);                                             // 66-128: Filler
  
  if (rec.length > 128) rec = rec.slice(0, 128);
  if (rec.length < 128) rec = rec + ' '.repeat(128 - rec.length);
  return rec;
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Generate MASAV preview records (for display, not file output)
 */
export function generateMasavPreview(
  settings: SystemSettings,
  donors: Donor[],
  collectionDate: string
): MasavPreviewRecord[] {
  const records: MasavPreviewRecord[] = [];
  
  records.push({
    type: 'header',
    raw: buildHeaderRecord(settings, collectionDate),
    fields: {
      'סוג רשומה': 'K - כותרת',
      'מספר מוסד': padLeft(settings.masvInstitutionNumber, 8),
      'מטבע': '00 (שקל)',
      'תאריך תשלום': collectionDate,
      'תאריך יצירה': new Date().toISOString().split('T')[0],
      'מוסד שולח': padLeft(settings.sendingInstitutionNumber || settings.masvInstitutionNumber, 5),
      'שם מוסד': settings.organizationName,
    },
  });

  let totalAmount = 0;
  for (const donor of donors) {
    totalAmount += donor.monthlyAmount;
    records.push({
      type: 'transaction',
      raw: buildTransactionRecord(settings, donor, collectionDate),
      fields: {
        'סוג רשומה': '1 - תנועה',
        'שם': donor.fullName,
        'בנק': padLeft(donor.bankNumber, 2),
        'סניף': padLeft(donor.branchNumber, 3),
        'חשבון': padLeft(donor.accountNumber, 9),
        'ת.ז.': padLeft(donor.idNumber, 9),
        'סכום': `₪${donor.monthlyAmount.toLocaleString()}`,
        'סוג תנועה': '006 (זיכוי רגיל)',
      },
    });
  }

  records.push({
    type: 'summary',
    raw: buildSummaryRecord(settings, collectionDate, totalAmount, donors.length),
    fields: {
      'סוג רשומה': '5 - סיכום',
      'סה"כ סכום': `₪${totalAmount.toLocaleString()}`,
      'מספר תנועות': donors.length.toString(),
      'תאריך תשלום': collectionDate,
    },
  });

  return records;
}

/**
 * Generate the MASAV file as a properly encoded Windows-1255 Blob
 */
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

  // Encode each line to Windows-1255 and join with CR+LF
  const encodedLines: Uint8Array[] = lines.map(line => encodeWin1255(line));
  const crlf = new Uint8Array([0x0D, 0x0A]);
  
  // Calculate total size
  let totalSize = 0;
  for (let i = 0; i < encodedLines.length; i++) {
    totalSize += encodedLines[i].length;
    if (i < encodedLines.length - 1) totalSize += 2; // CR+LF between lines
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

/**
 * Legacy string-based generator (kept for backward compat, prefer generateMasavBlob)
 */
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
