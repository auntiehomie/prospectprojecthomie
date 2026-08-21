// ─── Prospect Intelligence Storage Layer ─────────────────────────────
// Durable storage for evidence, contacts, feedback, outreach outcomes,
// and opt-out suppression. JSON-file-backed in development; designed
// to swap to Neon/Postgres in production with the same interface.
// ──────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// ─── Types ──────────────────────────────────────────────────────────

export interface StoredEvidence {
  id: string;
  businessName: string;
  address: string;
  label: string;
  source: string;
  confidence: 'confirmed' | 'likely' | 'possible' | 'unverified';
  detail: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredContact {
  id: string;
  businessName: string;
  address: string;
  contactType: 'phone' | 'email' | 'linkedin' | 'website' | 'other';
  value: string;
  source: string;
  verified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredFeedback {
  id: string;
  businessName: string;
  address: string;
  recommendationId: string;
  agreement: 'agree' | 'disagree' | 'partial' | 'skip';
  notes: string;
  createdAt: string;
}

export interface StoredOutreach {
  id: string;
  businessName: string;
  address: string;
  outcome: 'pending' | 'contacted' | 'responded' | 'qualified' | 'not_interested' | 'opted_out';
  notes: string;
  contactMethod?: string;
  contactedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OptOutEntry {
  businessName: string;
  address: string;
  reason: string;
  createdAt: string;
}

export interface StorageStats {
  evidenceCount: number;
  contactCount: number;
  feedbackCount: number;
  outreachCount: number;
  optOutCount: number;
}

// ─── File-backed store ──────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), 'data');

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readStore<T>(filename: string): T[] {
  ensureDir();
  const path = join(DATA_DIR, filename);
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T[];
  } catch {
    return [];
  }
}

function writeStore<T>(filename: string, data: T[]): void {
  ensureDir();
  writeFileSync(join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf-8');
}

// ─── Evidence ───────────────────────────────────────────────────────

const EVIDENCE_FILE = 'evidence.json';

export function getEvidence(businessName?: string): StoredEvidence[] {
  const all = readStore<StoredEvidence>(EVIDENCE_FILE);
  if (!businessName) return all;
  return all.filter((e) => e.businessName === businessName);
}

export function addEvidence(entry: Omit<StoredEvidence, 'id' | 'createdAt' | 'updatedAt'>): StoredEvidence {
  const all = readStore<StoredEvidence>(EVIDENCE_FILE);
  const now = new Date().toISOString();
  const item: StoredEvidence = { ...entry, id: randomUUID(), createdAt: now, updatedAt: now };
  all.push(item);
  writeStore(EVIDENCE_FILE, all);
  return item;
}

export function updateEvidence(id: string, patch: Partial<Omit<StoredEvidence, 'id' | 'businessName' | 'address' | 'createdAt'>>): StoredEvidence | null {
  const all = readStore<StoredEvidence>(EVIDENCE_FILE);
  const idx = all.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  writeStore(EVIDENCE_FILE, all);
  return all[idx];
}

export function deleteEvidence(id: string): boolean {
  const all = readStore<StoredEvidence>(EVIDENCE_FILE);
  const filtered = all.filter((e) => e.id !== id);
  if (filtered.length === all.length) return false;
  writeStore(EVIDENCE_FILE, filtered);
  return true;
}

// ─── Contacts ───────────────────────────────────────────────────────

const CONTACTS_FILE = 'contacts.json';

export function getContacts(businessName?: string): StoredContact[] {
  const all = readStore<StoredContact>(CONTACTS_FILE);
  if (!businessName) return all;
  return all.filter((c) => c.businessName === businessName);
}

export function addContact(entry: Omit<StoredContact, 'id' | 'createdAt' | 'updatedAt'>): StoredContact {
  const all = readStore<StoredContact>(CONTACTS_FILE);
  const now = new Date().toISOString();
  const item: StoredContact = { ...entry, id: randomUUID(), createdAt: now, updatedAt: now };
  all.push(item);
  writeStore(CONTACTS_FILE, all);
  return item;
}

export function updateContact(id: string, patch: Partial<Omit<StoredContact, 'id' | 'businessName' | 'address' | 'createdAt'>>): StoredContact | null {
  const all = readStore<StoredContact>(CONTACTS_FILE);
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  writeStore(CONTACTS_FILE, all);
  return all[idx];
}

export function deleteContact(id: string): boolean {
  const all = readStore<StoredContact>(CONTACTS_FILE);
  const filtered = all.filter((c) => c.id !== id);
  if (filtered.length === all.length) return false;
  writeStore(CONTACTS_FILE, filtered);
  return true;
}

// ─── Feedback ───────────────────────────────────────────────────────

const FEEDBACK_FILE = 'feedback.json';

export function getFeedback(businessName?: string): StoredFeedback[] {
  const all = readStore<StoredFeedback>(FEEDBACK_FILE);
  if (!businessName) return all;
  return all.filter((f) => f.businessName === businessName);
}

export function addFeedback(entry: Omit<StoredFeedback, 'id' | 'createdAt'>): StoredFeedback {
  const all = readStore<StoredFeedback>(FEEDBACK_FILE);
  const item: StoredFeedback = { ...entry, id: randomUUID(), createdAt: new Date().toISOString() };
  all.push(item);
  writeStore(FEEDBACK_FILE, all);
  return item;
}

// ─── Outreach ───────────────────────────────────────────────────────

const OUTREACH_FILE = 'outreach.json';

export function getOutreach(businessName?: string): StoredOutreach[] {
  const all = readStore<StoredOutreach>(OUTREACH_FILE);
  if (!businessName) return all;
  return all.filter((o) => o.businessName === businessName);
}

export function addOutreach(entry: Omit<StoredOutreach, 'id' | 'createdAt' | 'updatedAt'>): StoredOutreach {
  const all = readStore<StoredOutreach>(OUTREACH_FILE);
  const now = new Date().toISOString();
  const item: StoredOutreach = { ...entry, id: randomUUID(), createdAt: now, updatedAt: now };
  all.push(item);
  writeStore(OUTREACH_FILE, all);
  return item;
}

export function updateOutreach(id: string, patch: Partial<Omit<StoredOutreach, 'id' | 'businessName' | 'address' | 'createdAt'>>): StoredOutreach | null {
  const all = readStore<StoredOutreach>(OUTREACH_FILE);
  const idx = all.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  writeStore(OUTREACH_FILE, all);
  return all[idx];
}

// ─── Opt-out ────────────────────────────────────────────────────────

const OPTOUT_FILE = 'optout.json';

export function getOptOuts(): OptOutEntry[] {
  return readStore<OptOutEntry>(OPTOUT_FILE);
}

export function isOptedOut(businessName: string, address: string): boolean {
  return getOptOuts().some((o) => o.businessName === businessName && o.address === address);
}

export function addOptOut(entry: Omit<OptOutEntry, 'createdAt'>): OptOutEntry {
  const all = readStore<OptOutEntry>(OPTOUT_FILE);
  const item: OptOutEntry = { ...entry, createdAt: new Date().toISOString() };
  all.push(item);
  writeStore(OPTOUT_FILE, all);
  return item;
}

export function removeOptOut(businessName: string, address: string): boolean {
  const all = readStore<OptOutEntry>(OPTOUT_FILE);
  const filtered = all.filter((o) => !(o.businessName === businessName && o.address === address));
  if (filtered.length === all.length) return false;
  writeStore(OPTOUT_FILE, filtered);
  return true;
}

// ─── Stats ──────────────────────────────────────────────────────────

export function getStats(): StorageStats {
  return {
    evidenceCount: readStore<StoredEvidence>(EVIDENCE_FILE).length,
    contactCount: readStore<StoredContact>(CONTACTS_FILE).length,
    feedbackCount: readStore<StoredFeedback>(FEEDBACK_FILE).length,
    outreachCount: readStore<StoredOutreach>(OUTREACH_FILE).length,
    optOutCount: readStore<OptOutEntry>(OPTOUT_FILE).length,
  };
}

// ─── Export all data (for backup/migration) ─────────────────────────

export function exportAll() {
  return {
    evidence: readStore<StoredEvidence>(EVIDENCE_FILE),
    contacts: readStore<StoredContact>(CONTACTS_FILE),
    feedback: readStore<StoredFeedback>(FEEDBACK_FILE),
    outreach: readStore<StoredOutreach>(OUTREACH_FILE),
    optOuts: readStore<OptOutEntry>(OPTOUT_FILE),
    exportedAt: new Date().toISOString(),
  };
}