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
  status: 'active' | 'frozen' | 'cancelled';
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
  status: 'active' | 'frozen' | 'cancelled';
  createdAt: string;
}

export interface Collection {
  id?: number;
  date: string;
  totalAmount: number;
  totalRecords: number;
  fileName: string;
  status: 'pending' | 'completed' | 'partial';
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
  status: 'success' | 'failed' | 'pending';
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
}

export interface SystemSettings {
  id?: number;
  organizationName: string;
  masvInstitutionNumber: string;
  creditBankNumber: string;
  creditBranchNumber: string;
  creditAccountNumber: string;
  defaultChargeDay: number;
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

  constructor() {
    super('MasavDB');
    this.version(1).stores({
      donors: '++id, fullName, idNumber, status, bankNumber',
      authorizations: '++id, donorId, status, chargeDay',
      collections: '++id, date, status',
      collectionItems: '++id, collectionId, donorId, status',
      failedDebits: '++id, collectionId, donorId, retried',
      banks: '++id, bankNumber, bankName',
      branches: '++id, bankNumber, branchNumber',
      settings: '++id',
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
