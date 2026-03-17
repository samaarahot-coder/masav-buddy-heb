import { describe, it, expect } from 'vitest';
import {
  padLeft,
  padRight,
  formatAmountTransaction,
  formatAmountSummary,
  formatDateYYMMDD,
  validateIsraeliId,
  validateBankNumber,
  validateBranchNumber,
  validateAccountNumber,
  findDuplicates,
  validateDonorsForMasav,
  validateCollectionDate,
  buildHeaderRecord,
  buildTransactionRecord,
  buildSummaryRecord,
  verifyFileIntegrity,
  dryRun,
  encodeWin1255,
} from '@/lib/masav-generator';
import type { SystemSettings, Donor } from '@/db/database';

// ─── Helpers ─────────────────────────────────────────────────────────

function makeSettings(overrides: Partial<SystemSettings> = {}): SystemSettings {
  return {
    organizationName: 'עמותת טסט',
    masvInstitutionNumber: '12345678',
    sendingInstitutionNumber: '12345',
    creditBankNumber: '12',
    creditBranchNumber: '345',
    creditAccountNumber: '123456789',
    defaultChargeDay: 15,
    ...overrides,
  };
}

function makeDonor(overrides: Partial<Donor> = {}): Donor {
  return {
    id: 1,
    fullName: 'ישראל ישראלי',
    phone: '0501234567',
    email: 'test@test.com',
    idNumber: '123456782', // valid Israeli ID
    address: 'רחוב 1',
    notes: '',
    bankNumber: '12',
    branchNumber: '345',
    accountNumber: '123456789',
    authorizationNumber: '1001',
    monthlyAmount: 100,
    chargeDay: 15,
    startDate: '2024-01-01',
    endDate: '',
    monthCount: 0,
    monthsCollected: 0,
    lastCollectedDate: '',
    status: 'active',
    groupId: null,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

// ─── Padding Tests ───────────────────────────────────────────────────

describe('padLeft', () => {
  it('pads with zeros', () => {
    expect(padLeft('5', 3)).toBe('005');
    expect(padLeft('123', 3)).toBe('123');
    expect(padLeft('', 4)).toBe('0000');
  });

  it('truncates if too long', () => {
    expect(padLeft('12345', 3)).toBe('123');
  });
});

describe('padRight', () => {
  it('pads with spaces', () => {
    expect(padRight('AB', 5)).toBe('AB   ');
    expect(padRight('', 3)).toBe('   ');
  });

  it('truncates if too long', () => {
    expect(padRight('ABCDE', 3)).toBe('ABC');
  });
});

// ─── Amount Formatting ───────────────────────────────────────────────

describe('formatAmountTransaction', () => {
  it('formats 100.00 correctly (11+2 = 13 chars)', () => {
    const result = formatAmountTransaction(100);
    expect(result).toBe('00000000100' + '00');
    expect(result.length).toBe(13);
  });

  it('formats 99.50 with agorot', () => {
    expect(formatAmountTransaction(99.50)).toBe('0000000009950');
  });

  it('handles zero', () => {
    expect(formatAmountTransaction(0)).toBe('0000000000000');
  });
});

describe('formatAmountSummary', () => {
  it('formats with 15 chars (13+2)', () => {
    const result = formatAmountSummary(1000);
    expect(result.length).toBe(15);
    expect(result).toBe('000000000100000');
  });
});

// ─── Date Formatting ─────────────────────────────────────────────────

describe('formatDateYYMMDD', () => {
  it('formats date correctly', () => {
    expect(formatDateYYMMDD('2025-03-15')).toBe('250315');
  });

  it('throws on invalid date', () => {
    expect(() => formatDateYYMMDD('invalid')).toThrow('תאריך לא חוקי');
  });
});

// ─── Israeli ID Validation ───────────────────────────────────────────

describe('validateIsraeliId', () => {
  it('validates correct IDs', () => {
    expect(validateIsraeliId('123456782')).toBe(true);
    expect(validateIsraeliId('000000018')).toBe(true);
  });

  it('rejects invalid IDs', () => {
    expect(validateIsraeliId('123456789')).toBe(false);
    expect(validateIsraeliId('')).toBe(false);
    expect(validateIsraeliId('abc')).toBe(false);
  });
});

// ─── Bank Validations ────────────────────────────────────────────────

describe('validateBankNumber', () => {
  it('accepts valid bank numbers', () => {
    expect(validateBankNumber('12')).toBe(true);
    expect(validateBankNumber('1')).toBe(true);
  });

  it('rejects invalid', () => {
    expect(validateBankNumber('')).toBe(false);
    expect(validateBankNumber('0')).toBe(false);
    expect(validateBankNumber('100')).toBe(false);
    expect(validateBankNumber('ab')).toBe(false);
  });
});

describe('validateBranchNumber', () => {
  it('accepts valid branch numbers', () => {
    expect(validateBranchNumber('345')).toBe(true);
    expect(validateBranchNumber('1')).toBe(true);
  });

  it('rejects invalid', () => {
    expect(validateBranchNumber('')).toBe(false);
    expect(validateBranchNumber('0')).toBe(false);
    expect(validateBranchNumber('1000')).toBe(false);
  });
});

describe('validateAccountNumber', () => {
  it('accepts valid account numbers', () => {
    expect(validateAccountNumber('123456789')).toBe(true);
    expect(validateAccountNumber('1')).toBe(true);
  });

  it('rejects invalid', () => {
    expect(validateAccountNumber('')).toBe(false);
    expect(validateAccountNumber('0')).toBe(false);
    expect(validateAccountNumber('1234567890')).toBe(false);
  });
});

// ─── Duplicate Detection ─────────────────────────────────────────────

describe('findDuplicates', () => {
  it('finds no duplicates in unique donors', () => {
    const donors = [
      makeDonor({ accountNumber: '111' }),
      makeDonor({ accountNumber: '222' }),
    ];
    expect(findDuplicates(donors)).toHaveLength(0);
  });

  it('detects duplicates with same bank+branch+account', () => {
    const donors = [
      makeDonor({ fullName: 'A', bankNumber: '12', branchNumber: '345', accountNumber: '111' }),
      makeDonor({ fullName: 'B', bankNumber: '12', branchNumber: '345', accountNumber: '111' }),
    ];
    expect(findDuplicates(donors)).toHaveLength(1);
    expect(findDuplicates(donors)[0].donorName).toContain('B');
  });
});

// ─── Donor Validation ────────────────────────────────────────────────

describe('validateDonorsForMasav', () => {
  it('passes with valid settings and donors', () => {
    const errors = validateDonorsForMasav(makeSettings(), [makeDonor()]);
    expect(errors).toHaveLength(0);
  });

  it('catches missing institution number', () => {
    const errors = validateDonorsForMasav(
      makeSettings({ masvInstitutionNumber: '', sendingInstitutionNumber: '' }),
      [makeDonor()]
    );
    expect(errors.some(e => e.donorName === 'הגדרות מערכת')).toBe(true);
  });

  it('catches invalid bank number on donor', () => {
    const errors = validateDonorsForMasav(makeSettings(), [makeDonor({ bankNumber: 'abc' })]);
    expect(errors.some(e => e.errors.some(err => err.includes('בנק')))).toBe(true);
  });

  it('catches zero amount', () => {
    const errors = validateDonorsForMasav(makeSettings(), [makeDonor({ monthlyAmount: 0 })]);
    expect(errors.some(e => e.errors.some(err => err.includes('סכום')))).toBe(true);
  });
});

// ─── Collection Date Validation ──────────────────────────────────────

describe('validateCollectionDate', () => {
  it('accepts today', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(validateCollectionDate(today)).toHaveLength(0);
  });

  it('rejects empty date', () => {
    expect(validateCollectionDate('')).not.toHaveLength(0);
  });

  it('rejects date too far in past', () => {
    const old = new Date();
    old.setDate(old.getDate() - 100);
    expect(validateCollectionDate(old.toISOString().split('T')[0]).length).toBeGreaterThan(0);
  });
});

// ─── Record Building ─────────────────────────────────────────────────

describe('buildHeaderRecord', () => {
  it('produces exactly 128 chars', () => {
    const rec = buildHeaderRecord(makeSettings(), '2025-03-15');
    expect(rec.length).toBe(128);
  });

  it('starts with K and ends with KOT', () => {
    const rec = buildHeaderRecord(makeSettings(), '2025-03-15');
    expect(rec[0]).toBe('K');
    expect(rec.slice(125, 128)).toBe('KOT');
  });
});

describe('buildTransactionRecord', () => {
  it('produces exactly 128 chars', () => {
    const rec = buildTransactionRecord(makeSettings(), makeDonor(), '2025-03-15');
    expect(rec.length).toBe(128);
  });

  it('starts with 1 and contains 504 debit code', () => {
    const rec = buildTransactionRecord(makeSettings(), makeDonor(), '2025-03-15');
    expect(rec[0]).toBe('1');
    expect(rec.substring(105, 108)).toBe('504');
  });
});

describe('buildSummaryRecord', () => {
  it('produces exactly 128 chars', () => {
    const rec = buildSummaryRecord(makeSettings(), '2025-03-15', 1000, 5);
    expect(rec.length).toBe(128);
  });

  it('starts with 5', () => {
    const rec = buildSummaryRecord(makeSettings(), '2025-03-15', 1000, 5);
    expect(rec[0]).toBe('5');
  });

  it('encodes amount and count correctly', () => {
    const rec = buildSummaryRecord(makeSettings(), '2025-03-15', 500.50, 3);
    // Amount at pos 37-51 (0-indexed 36-50): 13 shekel + 2 agorot = 000000000050050
    expect(rec.substring(36, 51)).toBe('000000000050050');
    // Count at pos 59-65 (0-indexed 58-64):
    expect(rec.substring(58, 65)).toBe('0000003');
  });
});

// ─── File Integrity ──────────────────────────────────────────────────

describe('verifyFileIntegrity', () => {
  it('passes for a valid file', () => {
    const settings = makeSettings();
    const donors = [makeDonor()];
    const lines = [
      buildHeaderRecord(settings, '2025-03-15'),
      buildTransactionRecord(settings, donors[0], '2025-03-15'),
      buildSummaryRecord(settings, '2025-03-15', 100, 1),
      '9'.repeat(128),
    ];
    const errors = verifyFileIntegrity(lines, donors, 100);
    expect(errors).toHaveLength(0);
  });

  it('detects wrong record count', () => {
    const settings = makeSettings();
    const donors = [makeDonor()];
    const lines = [
      buildHeaderRecord(settings, '2025-03-15'),
      buildSummaryRecord(settings, '2025-03-15', 100, 1),
      '9'.repeat(128),
    ];
    const errors = verifyFileIntegrity(lines, donors, 100);
    expect(errors.some(e => e.includes('מספר רשומות'))).toBe(true);
  });

  it('detects wrong record length', () => {
    const errors = verifyFileIntegrity(['short', '9'.repeat(128)], [], 0);
    expect(errors.some(e => e.includes('אורך'))).toBe(true);
  });
});

// ─── Dry Run ─────────────────────────────────────────────────────────

describe('dryRun', () => {
  it('returns valid for good data', () => {
    const today = new Date().toISOString().split('T')[0];
    const result = dryRun(makeSettings(), [makeDonor()], today);
    expect(result.valid).toBe(true);
    expect(result.totalRecords).toBe(1);
    expect(result.totalAmount).toBe(100);
    expect(result.duplicates).toHaveLength(0);
    expect(result.validationErrors).toHaveLength(0);
    expect(result.integrityErrors).toHaveLength(0);
  });

  it('detects validation errors', () => {
    const today = new Date().toISOString().split('T')[0];
    const result = dryRun(makeSettings(), [makeDonor({ bankNumber: '' })], today);
    expect(result.valid).toBe(false);
    expect(result.validationErrors.length).toBeGreaterThan(0);
  });

  it('detects duplicates', () => {
    const donors = [
      makeDonor({ id: 1, fullName: 'A' }),
      makeDonor({ id: 2, fullName: 'B' }),
    ];
    const today = new Date().toISOString().split('T')[0];
    const result = dryRun(makeSettings(), donors, today);
    expect(result.duplicates).toHaveLength(1);
    expect(result.valid).toBe(false);
  });
});

// ─── Encoding ────────────────────────────────────────────────────────

describe('encodeWin1255', () => {
  it('encodes ASCII correctly', () => {
    const bytes = encodeWin1255('ABC');
    expect(bytes).toEqual(new Uint8Array([65, 66, 67]));
  });

  it('encodes Hebrew alef', () => {
    const bytes = encodeWin1255('א');
    expect(bytes[0]).toBe(0xE0);
  });

  it('replaces unknown chars with space', () => {
    const bytes = encodeWin1255('😀');
    expect(bytes[0]).toBe(0x20);
  });
});
