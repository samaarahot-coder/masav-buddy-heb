import { type SystemSettings, type Donor } from '@/db/database';

/**
 * MASAV File Generator - Based on official MASAV specification (זיכויים/תשלומים)
 * 
 * Record length: 128 characters + CR LF (positions 129-130)
 * Code: ASCII
 * 
 * File structure:
 * - Header record (K) - first record
 * - Transaction records (1) - N records
 * - Summary record (5) - last record
 */

function padRight(str: string, len: number, char = ' '): string {
  return (str || '').slice(0, len).padEnd(len, char);
}

function padLeft(str: string, len: number, char = '0'): string {
  return (str || '').slice(0, len).padStart(len, char);
}

function formatAmount(amount: number): string {
  // 13 chars total: 11 shekel digits + 2 agorot digits
  const agorot = Math.round(amount * 100);
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

/**
 * Validate all donors before MASAV generation
 */
export function validateDonorsForMasav(
  settings: SystemSettings,
  donors: Donor[]
): MasavValidationError[] {
  const errors: MasavValidationError[] = [];

  if (!settings.masvInstitutionNumber || settings.masvInstitutionNumber.length > 8) {
    errors.push({
      donorName: 'הגדרות מערכת',
      donorId: 0,
      errors: ['מספר מוסד מס"ב חייב להיות עד 8 ספרות'],
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

/**
 * Generate MASAV preview records without creating the file
 */
export function generateMasavPreview(
  settings: SystemSettings,
  donors: Donor[],
  collectionDate: string
): MasavPreviewRecord[] {
  const records: MasavPreviewRecord[] = [];
  const headerRaw = buildHeaderRecord(settings, collectionDate);
  records.push({
    type: 'header',
    raw: headerRaw,
    fields: {
      'סוג רשומה': 'K - כותרת',
      'מספר מוסד': settings.masvInstitutionNumber,
      'תאריך תשלום': collectionDate,
      'שם מוסד': settings.organizationName,
    },
  });

  let totalAmount = 0;
  for (const donor of donors) {
    const txRaw = buildTransactionRecord(settings, donor, collectionDate);
    totalAmount += donor.monthlyAmount;
    records.push({
      type: 'transaction',
      raw: txRaw,
      fields: {
        'סוג רשומה': '1 - תנועה',
        'שם': donor.fullName,
        'בנק': donor.bankNumber,
        'סניף': donor.branchNumber,
        'חשבון': donor.accountNumber,
        'סכום': `₪${donor.monthlyAmount.toLocaleString()}`,
        'ת.ז.': donor.idNumber,
      },
    });
  }

  const summaryRaw = buildSummaryRecord(settings, collectionDate, totalAmount, donors.length);
  records.push({
    type: 'summary',
    raw: summaryRaw,
    fields: {
      'סוג רשומה': '5 - סיכום',
      'סה"כ סכום': `₪${totalAmount.toLocaleString()}`,
      'מספר תנועות': donors.length.toString(),
    },
  });

  return records;
}

/**
 * Generate the MASAV file content
 */
export function generateMasavFile(
  settings: SystemSettings,
  donors: Donor[],
  collectionDate: string
): string {
  const lines: string[] = [];

  // Header
  lines.push(buildHeaderRecord(settings, collectionDate));

  // Transactions
  let totalAmount = 0;
  for (const donor of donors) {
    lines.push(buildTransactionRecord(settings, donor, collectionDate));
    totalAmount += donor.monthlyAmount;
  }

  // Summary
  lines.push(buildSummaryRecord(settings, collectionDate, totalAmount, donors.length));

  // End with 9s record (required after last summary)
  lines.push('9'.repeat(128));

  return lines.join('\r\n');
}

/**
 * Header Record (K) - Per MASAV spec section 3.1
 * Total: 128 chars
 */
function buildHeaderRecord(settings: SystemSettings, collectionDate: string): string {
  const record =
    'K' +                                                         // Pos 1: Record ID
    padLeft(settings.masvInstitutionNumber, 8) +                  // Pos 2-9: Institution code
    '00' +                                                        // Pos 10-11: Currency (shekel)
    formatDateYYMMDD(collectionDate) +                            // Pos 12-17: Payment date
    '0' +                                                         // Pos 18: Filler
    '001' +                                                       // Pos 19-21: Serial number
    '0' +                                                         // Pos 22: Filler
    formatDateYYMMDD(new Date().toISOString()) +                  // Pos 23-28: Creation date
    padLeft(settings.sendingInstitutionNumber || settings.masvInstitutionNumber, 5).slice(0, 5) + // Pos 29-33: Sending institution
    '000000' +                                                    // Pos 34-39: Filler
    padRight(settings.organizationName, 30) +                     // Pos 40-69: Institution name
    padRight('', 56) +                                            // Pos 70-125: Filler
    'KOT';                                                        // Pos 126-128: Header ID

  return record.slice(0, 128);
}

/**
 * Transaction Record (1) - Per MASAV spec section 3.2
 * Total: 128 chars
 */
function buildTransactionRecord(settings: SystemSettings, donor: Donor, collectionDate: string): string {
  const currentPeriod = getCurrentYYMM();
  
  const record =
    '1' +                                                         // Pos 1: Record ID
    padLeft(settings.masvInstitutionNumber, 8) +                  // Pos 2-9: Institution code
    '00' +                                                        // Pos 10-11: Currency
    '000000' +                                                    // Pos 12-17: Filler
    padLeft(donor.bankNumber, 2) +                                // Pos 18-19: Bank code
    padLeft(donor.branchNumber, 3) +                              // Pos 20-22: Branch number
    '0000' +                                                      // Pos 23-26: Account type
    padLeft(donor.accountNumber, 9) +                             // Pos 27-35: Account number
    '0' +                                                         // Pos 36: Filler
    padLeft(donor.idNumber || '0', 9) +                           // Pos 37-45: ID number
    padRight(donor.fullName, 16) +                                // Pos 46-61: Name
    formatAmount(donor.monthlyAmount) +                           // Pos 62-74: Amount (13 chars)
    padRight(donor.authorizationNumber || '', 20) +               // Pos 75-94: Reference
    currentPeriod + currentPeriod +                               // Pos 95-102: Payment period
    '000' +                                                       // Pos 103-105: Currency code
    '006' +                                                       // Pos 106-108: Transaction type (regular credit)
    padLeft('', 18, '0') +                                        // Pos 109-126: Filler
    '  ';                                                         // Pos 127-128: Filler

  return record.slice(0, 128);
}

/**
 * Summary Record (5) - Per MASAV spec section 3.3
 * Total: 128 chars
 */
function buildSummaryRecord(
  settings: SystemSettings,
  collectionDate: string,
  totalAmount: number,
  recordCount: number
): string {
  const record =
    '5' +                                                         // Pos 1: Record ID
    padLeft(settings.masvInstitutionNumber, 8) +                  // Pos 2-9: Institution code
    '00' +                                                        // Pos 10-11: Currency
    formatDateYYMMDD(collectionDate) +                            // Pos 12-17: Payment date
    '0' +                                                         // Pos 18: Filler
    '001' +                                                       // Pos 19-21: Serial number
    padLeft(Math.round(totalAmount * 100).toString(), 15, '0') +  // Pos 22-36: Total amount (agorot)
    padLeft('', 15, '0') +                                        // Pos 37-51: Filler zeros
    padLeft(recordCount.toString(), 7, '0') +                     // Pos 52-58: Number of transactions
    padLeft('', 7, '0') +                                         // Pos 59-65: Filler
    padRight('', 63);                                             // Pos 66-128: Filler

  return record.slice(0, 128);
}
