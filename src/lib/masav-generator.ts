import { type SystemSettings, type Donor } from '@/db/database';

/**
 * MASAV Debit File Generator (חיובים / Get Payments)
 * Based on official MASAV specification: Mifrat Hiuvim MSV
 * Reference: https://github.com/ElishaMayer/masav
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

function encodeWin1255(str: string): Uint8Array {
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

function padRight(str: string, len: number, char = ' '): string {
  const s = (str || '').slice(0, len);
  return s + char.repeat(Math.max(0, len - s.length));
}

function padLeft(str: string, len: number, char = '0'): string {
  const s = (str || '').slice(0, len);
  return char.repeat(Math.max(0, len - s.length)) + s;
}

function formatAmountTransaction(amount: number): string {
  // Transaction: 11 shekel digits + 2 agorot digits = 13 chars total (pos 62-74)
  const totalAgorot = Math.round(Math.abs(amount) * 100);
  const shekel = Math.floor(totalAgorot / 100);
  const agorot = totalAgorot % 100;
  return padLeft(shekel.toString(), 11) + padLeft(agorot.toString(), 2);
}

function formatAmountSummary(amount: number): string {
  // Summary: 13 shekel digits + 2 agorot digits = 15 chars total
  const totalAgorot = Math.round(Math.abs(amount) * 100);
  const shekel = Math.floor(totalAgorot / 100);
  const agorot = totalAgorot % 100;
  return padLeft(shekel.toString(), 13) + padLeft(agorot.toString(), 2);
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
 * Header Record (K) - Same for both credit and debit files
 * 
 * Pos 1     (1)  Record ID = 'K'
 * Pos 2-9   (8)  Institution/subject code (N)
 * Pos 10-11 (2)  Currency = '00' (N)
 * Pos 12-17 (6)  Date of payment YYMMDD (N)
 * Pos 18    (1)  Filler = '0' (N)
 * Pos 19-21 (3)  Serial number = '001' (N)
 * Pos 22    (1)  Filler = '0' (N)
 * Pos 23-28 (6)  Date tape created YYMMDD (N)
 * Pos 29-33 (5)  Sending institution number (N)
 * Pos 34-39 (6)  Filler = zeros (N)
 * Pos 40-69 (30) Name of institution (X, right-aligned)
 * Pos 70-125(56) Filler = blanks (X)
 * Pos 126-128(3) Header ID = 'KOT' (X)
 */
function buildHeaderRecord(settings: SystemSettings, collectionDate: string): string {
  let rec = '';
  rec += 'K';                                                          // 1
  rec += padLeft(settings.masvInstitutionNumber, 8);                   // 2-9
  rec += '00';                                                         // 10-11
  rec += formatDateYYMMDD(collectionDate);                             // 12-17
  rec += '0';                                                          // 18
  rec += '001';                                                        // 19-21
  rec += '0';                                                          // 22
  rec += formatDateYYMMDD(new Date().toISOString());                   // 23-28
  const sendingInst = settings.sendingInstitutionNumber || settings.masvInstitutionNumber;
  rec += padLeft(sendingInst, 5);                                      // 29-33
  rec += '000000';                                                     // 34-39
  rec += padRight(settings.organizationName, 30);                      // 40-69
  rec += padRight('', 56);                                             // 70-125
  rec += 'KOT';                                                        // 126-128
  
  if (rec.length > 128) rec = rec.slice(0, 128);
  if (rec.length < 128) rec = rec + ' '.repeat(128 - rec.length);
  return rec;
}

/**
 * Debit Movement Record - MASAV Get Payments (חיובים)
 * 
 * Pos 1     (1)  Record ID = '1' (X)
 * Pos 2-9   (8)  Institution/subject (N)
 * Pos 10-11 (2)  Currency = '00' (N)
 * Pos 12-17 (6)  Filler = '000000' (N)
 * Pos 18-19 (2)  Bank code (N)
 * Pos 20-22 (3)  Branch number (N)
 * Pos 23-26 (4)  Account type = '0000' (N)
 * Pos 27-35 (9)  Account number (N)
 * Pos 36    (1)  Filler = '0' (N)
 * Pos 37-45 (9)  ID number (N)
 * Pos 46-61 (16) Name (X, right-aligned for Hebrew)
 * Pos 62-74 (13) Amount: 11 shekel + 2 agorot (N)
 * Pos 75-94 (20) Reference/payee number (N)
 * Pos 95-102(8)  Payment period YYMM+YYMM (N)
 * Pos 103-105(3) Text code = '000' (N)
 * Pos 106-108(3) Movement type = '504' (DEBIT) (N)
 * Pos 109-126(18) Filler = zeros (N)
 * Pos 127-128(2) Filler = blanks (X)
 */
function buildTransactionRecord(settings: SystemSettings, donor: Donor, _collectionDate: string): string {
  const period = getCurrentYYMM();
  
  let rec = '';
  rec += '1';                                                          // 1
  rec += padLeft(settings.masvInstitutionNumber, 8);                   // 2-9
  rec += '00';                                                         // 10-11
  rec += '000000';                                                     // 12-17
  rec += padLeft(donor.bankNumber, 2);                                 // 18-19
  rec += padLeft(donor.branchNumber, 3);                               // 20-22
  rec += '0000';                                                       // 23-26
  rec += padLeft(donor.accountNumber, 9);                              // 27-35
  rec += '0';                                                          // 36
  rec += padLeft(donor.idNumber || '0', 9);                            // 37-45
  rec += padRight(donor.fullName, 16);                                 // 46-61
  rec += formatAmountTransaction(donor.monthlyAmount);                 // 62-74 (11+2=13)
  rec += padLeft(donor.authorizationNumber || '', 20);                 // 75-94
  rec += period + period;                                              // 95-102
  rec += '000';                                                        // 103-105
  rec += '504';                                                        // 106-108: DEBIT type (חיוב)
  rec += padLeft('', 18, '0');                                         // 109-126
  rec += '  ';                                                         // 127-128
  
  if (rec.length > 128) rec = rec.slice(0, 128);
  if (rec.length < 128) rec = rec + ' '.repeat(128 - rec.length);
  return rec;
}

/**
 * Debit Summary Record (5) - Get Payments (חיובים)
 * IMPORTANT: For debit files, positions 7&8 and 9&10 are SWAPPED vs credit files
 * 
 * Pos 1     (1)  Record ID = '5' (X)
 * Pos 2-9   (8)  Institution/subject (N)
 * Pos 10-11 (2)  Currency = '00' (N)
 * Pos 12-17 (6)  Date of payment YYMMDD (N)
 * Pos 18    (1)  Filler = '0' (N)
 * Pos 19-21 (3)  Serial number = '001' (N)
 * Pos 22-36 (15) Filler = zeros (credits total, empty for debit file) (N)
 * Pos 37-51 (15) Sum of debit movements: 13 shekel + 2 agorot (N)
 * Pos 52-58 (7)  Filler = zeros (credit count, empty for debit file) (N)
 * Pos 59-65 (7)  Number of debit movements (N)
 * Pos 66-128(63) Filler = blanks (X)
 */
function buildSummaryRecord(
  settings: SystemSettings,
  collectionDate: string,
  totalAmount: number,
  recordCount: number
): string {
  let rec = '';
  rec += '5';                                                          // 1
  rec += padLeft(settings.masvInstitutionNumber, 8);                   // 2-9
  rec += '00';                                                         // 10-11
  rec += formatDateYYMMDD(collectionDate);                             // 12-17
  rec += '0';                                                          // 18
  rec += '001';                                                        // 19-21
  rec += padLeft('', 15, '0');                                         // 22-36: Credits total = zeros (debit file)
  rec += formatAmountSummary(totalAmount);                             // 37-51: Debits total (13 shekel + 2 agorot)
  rec += padLeft('', 7, '0');                                          // 52-58: Credits count = zeros
  rec += padLeft(recordCount.toString(), 7, '0');                      // 59-65: Debits count
  rec += padRight('', 63);                                             // 66-128: Filler blanks
  
  if (rec.length > 128) rec = rec.slice(0, 128);
  if (rec.length < 128) rec = rec + ' '.repeat(128 - rec.length);
  return rec;
}

// ─── Public API ──────────────────────────────────────────────────────

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
        'סוג רשומה': '1 - תנועה (חיוב)',
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

  records.push({
    type: 'summary',
    raw: buildSummaryRecord(settings, collectionDate, totalAmount, donors.length),
    fields: {
      'סוג רשומה': '5 - סיכום',
      'סה"כ חיובים': `₪${totalAmount.toLocaleString()}`,
      'מספר תנועות חיוב': donors.length.toString(),
      'תאריך תשלום': collectionDate,
    },
  });

  return records;
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
