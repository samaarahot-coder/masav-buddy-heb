import { type SystemSettings, type Donor } from '@/db/database';

/**
 * MASAV File Generator
 * Generates fixed-width text files according to MASAV specification.
 * 
 * File structure:
 * - Header record (1 line)
 * - Debit records (N lines)
 * - Summary record (1 line)
 * 
 * All fields are fixed-width with specific padding rules.
 */

function padRight(str: string, len: number, char = ' '): string {
  return (str || '').slice(0, len).padEnd(len, char);
}

function padLeft(str: string, len: number, char = '0'): string {
  return (str || '').slice(0, len).padStart(len, char);
}

function formatAmount(amount: number, len: number): string {
  // Amount in agorot (cents), no decimal point
  const agorot = Math.round(amount * 100);
  return padLeft(agorot.toString(), len, '0');
}

function formatDate(dateStr: string): string {
  // Format: YYMMDD (6 chars) or YYYYMMDD (8 chars)
  const d = new Date(dateStr);
  const yy = d.getFullYear().toString().slice(-2);
  const mm = padLeft((d.getMonth() + 1).toString(), 2);
  const dd = padLeft(d.getDate().toString(), 2);
  return yy + mm + dd;
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear().toString();
  const mm = padLeft((d.getMonth() + 1).toString(), 2);
  const dd = padLeft(d.getDate().toString(), 2);
  return yyyy + mm + dd;
}

export function generateMasavFile(
  settings: SystemSettings,
  donors: Donor[],
  collectionDate: string
): string {
  const lines: string[] = [];

  // ===== HEADER RECORD =====
  // Record type: 1 char = 'K' (header)
  // Institution number: 8 chars
  // Creation date: 6 chars (YYMMDD)  
  // Value date: 6 chars (YYMMDD)
  // File type: 2 chars = '32' (direct debit)
  // Institution name: 30 chars
  // Credit bank: 2 chars
  // Credit branch: 3 chars
  // Credit account: 9 chars
  // Filler: rest
  const header = [
    'K',                                                      // Record type
    padLeft(settings.masvInstitutionNumber, 8),               // Institution number
    formatDate(new Date().toISOString()),                     // Creation date
    formatDate(collectionDate),                               // Value date
    '32',                                                     // File type (direct debit)
    padRight(settings.organizationName, 30),                  // Institution name
    padLeft(settings.creditBankNumber, 2),                    // Credit bank
    padLeft(settings.creditBranchNumber, 3),                  // Credit branch
    padLeft(settings.creditAccountNumber, 9),                 // Credit account
    padRight('', 62),                                         // Filler
  ].join('');

  lines.push(header);

  // ===== DEBIT RECORDS =====
  let totalAmount = 0;
  let recordCount = 0;

  for (const donor of donors) {
    totalAmount += donor.monthlyAmount;
    recordCount++;

    // Record type: 1 char = 'D' (debit)
    // Bank number: 2 chars
    // Branch number: 3 chars
    // Account number: 9 chars
    // Debit/Credit: 1 char = '1' (debit)
    // Amount: 10 chars (in agorot)
    // Value date: 6 chars
    // Payer ID: 9 chars (ID number)
    // Payer name: 16 chars
    // Authorization number: 10 chars
    // Filler: rest
    const record = [
      'D',                                                    // Record type
      padLeft(donor.bankNumber, 2),                           // Bank number
      padLeft(donor.branchNumber, 3),                         // Branch number
      padLeft(donor.accountNumber, 9),                        // Account number
      '1',                                                    // Debit indicator
      formatAmount(donor.monthlyAmount, 10),                  // Amount (agorot)
      formatDate(collectionDate),                             // Value date
      padLeft(donor.idNumber, 9),                             // Payer ID
      padRight(donor.fullName, 16),                           // Payer name
      padLeft(donor.authorizationNumber, 10),                 // Authorization number
      padRight('', 59),                                       // Filler
    ].join('');

    lines.push(record);
  }

  // ===== SUMMARY RECORD =====
  // Record type: 1 char = 'S' (summary)
  // Total debit amount: 12 chars (in agorot)
  // Total credit amount: 12 chars
  // Total records: 7 chars
  // Filler: rest
  const summary = [
    'S',                                                      // Record type
    formatAmount(totalAmount, 12),                            // Total debit amount
    padLeft('0', 12),                                         // Total credit amount
    padLeft(recordCount.toString(), 7),                       // Total records
    padRight('', 94),                                         // Filler
  ].join('');

  lines.push(summary);

  return lines.join('\r\n');
}

/**
 * Validate a donor record for MASAV compliance
 */
export function validateDonorForMasav(donor: Donor): string[] {
  const errors: string[] = [];

  if (!donor.bankNumber || !/^\d{1,2}$/.test(donor.bankNumber)) {
    errors.push('מספר בנק חייב להיות 1-2 ספרות');
  }
  if (!donor.branchNumber || !/^\d{1,3}$/.test(donor.branchNumber)) {
    errors.push('מספר סניף חייב להיות 1-3 ספרות');
  }
  if (!donor.accountNumber || !/^\d{1,9}$/.test(donor.accountNumber)) {
    errors.push('מספר חשבון חייב להיות עד 9 ספרות');
  }
  if (!donor.authorizationNumber) {
    errors.push('מספר הרשאה חסר');
  }
  if (!donor.monthlyAmount || donor.monthlyAmount <= 0) {
    errors.push('סכום חייב להיות חיובי');
  }
  if (donor.monthlyAmount > 999999.99) {
    errors.push('סכום חורג מהמקסימום המותר');
  }

  return errors;
}
