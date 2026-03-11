import Dexie, { type Table } from 'dexie';

export interface Donor {
  id?: number;
  fullName: string;
  phone: string;
  email: string;
  idNumber: string;
  address: string;
  notes: string;
  bankNumber: string;
  branchNumber: string;
  accountNumber: string;
  authorizationNumber: string;
  monthlyAmount: number;
  chargeDay: number;
  startDate: string;
  endDate: string;
  monthCount: number; // 0 = unlimited
  monthsCollected: number; // how many months already collected
  lastCollectedDate: string; // last collection date YYYY-MM
  status: 'active' | 'frozen' | 'cancelled' | 'expired' | 'failed';
  groupId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Authorization {
  id?: number;
  donorId: number;
  amount: number;
  chargeDay: number;
  startDate: string;
  endDate: string;
  monthCount: number;
  monthsCollected: number;
  status: 'active' | 'frozen' | 'cancelled' | 'expired';
  createdAt: string;
}

export interface Collection {
  id?: number;
  date: string;
  totalAmount: number;
  totalRecords: number;
  fileName: string;
  status: 'pending' | 'collected' | 'partial';
  createdAt: string;
}

export interface CollectionItem {
  id?: number;
  collectionId: number;
  donorId: number;
  donorName: string;
  bankNumber: string;
  branchNumber: string;
  accountNumber: string;
  authorizationNumber: string;
  amount: number;
  status: 'pending' | 'collected' | 'failed';
  failReason?: string;
}

export interface FailedDebit {
  id?: number;
  collectionItemId: number;
  collectionId: number;
  donorId: number;
  donorName: string;
  amount: number;
  reason: string;
  retried: boolean;
  retriedInCollectionId?: number;
  createdAt: string;
}

export interface Bank {
  id?: number;
  bankNumber: string;
  bankName: string;
}

export interface Branch {
  id?: number;
  bankNumber: string;
  branchNumber: string;
  branchName: string;
  address?: string;
  city?: string;
}

export interface SystemSettings {
  id?: number;
  organizationName: string;
  masvInstitutionNumber: string;
  sendingInstitutionNumber: string;
  creditBankNumber: string;
  creditBranchNumber: string;
  creditAccountNumber: string;
  defaultChargeDay: number;
}

export interface DonorGroup {
  id?: number;
  name: string;
  description: string;
  color: string;
  createdAt: string;
}

export interface ActivityLog {
  id?: number;
  action: string;
  description: string;
  entityType: string;
  entityId: number | null;
  entityName: string;
  details: string;
  reversible: boolean;
  reversed: boolean;
  reverseData: string; // JSON string for undo
  createdAt: string;
}

export interface Reminder {
  id?: number;
  title: string;
  description: string;
  donorId: number | null;
  donorName: string;
  type: 'once' | 'recurring' | 'scheduled';
  scheduledDate: string;
  recurringDay: number;
  completed: boolean;
  createdAt: string;
}

class MasavDatabase extends Dexie {
  donors!: Table<Donor>;
  authorizations!: Table<Authorization>;
  collections!: Table<Collection>;
  collectionItems!: Table<CollectionItem>;
  failedDebits!: Table<FailedDebit>;
  banks!: Table<Bank>;
  branches!: Table<Branch>;
  settings!: Table<SystemSettings>;
  donorGroups!: Table<DonorGroup>;
  activityLog!: Table<ActivityLog>;
  reminders!: Table<Reminder>;

  constructor() {
    super('MasavDB');
    this.version(2).stores({
      donors: '++id, fullName, idNumber, status, bankNumber, groupId',
      authorizations: '++id, donorId, status, chargeDay',
      collections: '++id, date, status',
      collectionItems: '++id, collectionId, donorId, status',
      failedDebits: '++id, collectionId, donorId, retried',
      banks: '++id, bankNumber, bankName',
      branches: '++id, bankNumber, branchNumber',
      settings: '++id',
      donorGroups: '++id, name',
      activityLog: '++id, entityType, createdAt',
      reminders: '++id, donorId, type, completed',
    });
  }
}

export const db = new MasavDatabase();

export async function getSettings(): Promise<SystemSettings | undefined> {
  return db.settings.toCollection().first();
}

export async function saveSettings(settings: Omit<SystemSettings, 'id'>): Promise<void> {
  const existing = await db.settings.toCollection().first();
  if (existing?.id) {
    await db.settings.update(existing.id, settings);
  } else {
    await db.settings.add(settings as SystemSettings);
  }
}

export async function logActivity(
  action: string,
  description: string,
  entityType: string,
  entityId: number | null,
  entityName: string,
  details: string = '',
  reversible: boolean = false,
  reverseData: string = ''
): Promise<void> {
  await db.activityLog.add({
    action,
    description,
    entityType,
    entityId,
    entityName,
    details,
    reversible,
    reversed: false,
    reverseData,
    createdAt: new Date().toISOString(),
  });
}

// Load banks from CSV on first run
export async function initializeBanks(): Promise<void> {
  const count = await db.banks.count();
  if (count > 0) return; // Already loaded

  try {
    const response = await fetch('/data/snifim_he.csv');
    const text = await response.text();
    const lines = text.split('\n');
    if (lines.length < 2) return;

    const seenBanks = new Set<string>();
    const banksToAdd: Bank[] = [];
    const branchesToAdd: Branch[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV with quoted fields
      const fields = parseCSVLine(line);
      if (fields.length < 6) continue;

      const bankCode = fields[0]?.trim();
      const bankName = fields[1]?.trim().replace(/""/g, '"');
      const branchCode = fields[2]?.trim();
      const branchName = fields[4]?.trim().replace(/""/g, '"');
      const address = fields[5]?.trim().replace(/""/g, '"');
      const city = fields[6]?.trim() || '';

      if (bankCode && bankName && !seenBanks.has(bankCode)) {
        banksToAdd.push({ bankNumber: bankCode, bankName });
        seenBanks.add(bankCode);
      }

      if (bankCode && branchCode) {
        branchesToAdd.push({
          bankNumber: bankCode,
          branchNumber: branchCode,
          branchName: branchName || `סניף ${branchCode}`,
          address: address || '',
          city,
        });
      }
    }

    if (banksToAdd.length > 0) await db.banks.bulkAdd(banksToAdd);
    if (branchesToAdd.length > 0) await db.branches.bulkAdd(branchesToAdd);
    console.log(`Loaded ${banksToAdd.length} banks and ${branchesToAdd.length} branches`);
  } catch (e) {
    console.error('Failed to load bank data:', e);
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
