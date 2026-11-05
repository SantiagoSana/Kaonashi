// KAONASHI DATASTORE INTERFACE & REPOSITORY ENGINE (§0.1 item 10, §12)
import EventEmitter from 'events';
import { getEnv } from '../env';
import { getSeedData } from './seed-data';
import {
  Branch,
  StaffUser,
  Customer,
  MenuItem,
  InventoryItem,
  Campaign,
  Touchpoint,
  QrCode,
  Coupon,
  CouponClaim,
  CouponRedemption,
  Lead,
  ScanEvent,
  FunnelEvent,
  Order,
  StatsDaily,
  DistributionLog,
  CostEntry,
  Reservation,
  LoyaltyAccount,
  LoyaltyLedgerEntry,
} from '../types';

export interface DataStore {
  // Collections
  branches: Collection<Branch>;
  staffUsers: Collection<StaffUser>;
  customers: Collection<Customer>;
  menuItems: Collection<MenuItem>;
  inventoryItems: Collection<InventoryItem>;
  campaigns: Collection<Campaign>;
  touchpoints: Collection<Touchpoint>;
  qrCodes: Collection<QrCode>;
  coupons: Collection<Coupon>;
  couponClaims: Collection<CouponClaim>;
  couponRedemptions: Collection<CouponRedemption>;
  leads: Collection<Lead>;
  scanEvents: Collection<ScanEvent>;
  funnelEvents: Collection<FunnelEvent>;
  orders: Collection<Order>;
  statsDaily: Collection<StatsDaily>;
  distributionLogs: Collection<DistributionLog>;
  costEntries: Collection<CostEntry>;
  reservations: Collection<Reservation>;
  loyaltyAccounts: Collection<LoyaltyAccount>;
  loyaltyLedgers: Collection<LoyaltyLedgerEntry>;

  // Pub/Sub Events for SSE
  events: EventEmitter;

  // Lifecycle
  init(): Promise<void>;
  resetDemoData(): Promise<void>;
  isUsingMemoryBackend(): boolean;
}

export interface Collection<T extends { id: string }> {
  get(id: string): Promise<T | null>;
  list(filter?: (item: T) => boolean): Promise<T[]>;
  create(item: T): Promise<T>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
  count(filter?: (item: T) => boolean): Promise<number>;
}

class MemoryCollection<T extends { id: string }> implements Collection<T> {
  private items: Map<string, T> = new Map();

  constructor(initialItems: T[] = []) {
    initialItems.forEach((i) => this.items.set(i.id, i));
  }

  async get(id: string): Promise<T | null> {
    return this.items.get(id) || null;
  }

  async list(filter?: (item: T) => boolean): Promise<T[]> {
    const all = Array.from(this.items.values());
    return filter ? all.filter(filter) : all;
  }

  async create(item: T): Promise<T> {
    this.items.set(item.id, { ...item });
    return item;
  }

  async update(id: string, updates: Partial<T>): Promise<T> {
    const existing = this.items.get(id);
    if (!existing) {
      throw new Error(`Item ${id} not found`);
    }
    const updated = { ...existing, ...updates };
    this.items.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }

  async count(filter?: (item: T) => boolean): Promise<number> {
    return (await this.list(filter)).length;
  }

  clear(): void {
    this.items.clear();
  }

  setAll(newItems: T[]): void {
    this.items.clear();
    newItems.forEach((i) => this.items.set(i.id, i));
  }
}

export class MemoryDataStore implements DataStore {
  branches = new MemoryCollection<Branch>();
  staffUsers = new MemoryCollection<StaffUser>();
  customers = new MemoryCollection<Customer>();
  menuItems = new MemoryCollection<MenuItem>();
  inventoryItems = new MemoryCollection<InventoryItem>();
  campaigns = new MemoryCollection<Campaign>();
  touchpoints = new MemoryCollection<Touchpoint>();
  qrCodes = new MemoryCollection<QrCode>();
  coupons = new MemoryCollection<Coupon>();
  couponClaims = new MemoryCollection<CouponClaim>();
  couponRedemptions = new MemoryCollection<CouponRedemption>();
  leads = new MemoryCollection<Lead>();
  scanEvents = new MemoryCollection<ScanEvent>();
  funnelEvents = new MemoryCollection<FunnelEvent>();
  orders = new MemoryCollection<Order>();
  statsDaily = new MemoryCollection<StatsDaily>();
  distributionLogs = new MemoryCollection<DistributionLog>();
  costEntries = new MemoryCollection<CostEntry>();
  reservations = new MemoryCollection<Reservation>();
  loyaltyAccounts = new MemoryCollection<LoyaltyAccount>();
  loyaltyLedgers = new MemoryCollection<LoyaltyLedgerEntry>();

  events = new EventEmitter();
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    const seed = getSeedData();

    (this.branches as MemoryCollection<Branch>).setAll(seed.branches);
    (this.staffUsers as MemoryCollection<StaffUser>).setAll(seed.staffUsers);
    (this.customers as MemoryCollection<Customer>).setAll(seed.customers);
    (this.menuItems as MemoryCollection<MenuItem>).setAll(seed.menuItems);
    (this.inventoryItems as MemoryCollection<InventoryItem>).setAll(seed.inventoryItems);
    (this.campaigns as MemoryCollection<Campaign>).setAll(seed.campaigns);
    (this.touchpoints as MemoryCollection<Touchpoint>).setAll(seed.touchpoints);
    (this.qrCodes as MemoryCollection<QrCode>).setAll(seed.qrCodes);
    (this.coupons as MemoryCollection<Coupon>).setAll(seed.coupons);
    (this.distributionLogs as MemoryCollection<DistributionLog>).setAll(seed.distributionLogs);
    (this.costEntries as MemoryCollection<CostEntry>).setAll(seed.costEntries);
    (this.statsDaily as MemoryCollection<StatsDaily>).setAll(seed.statsDaily);
    (this.orders as MemoryCollection<Order>).setAll(seed.orders);
    (this.reservations as MemoryCollection<Reservation>).setAll(seed.reservations);

    this.initialized = true;
  }

  async resetDemoData(): Promise<void> {
    this.initialized = false;
    await this.init();
    this.events.emit('reset', { timestamp: new Date().toISOString() });
  }

  isUsingMemoryBackend(): boolean {
    return true;
  }
}

// Global Singleton DataStore instance
let globalDataStore: DataStore | null = null;

export async function getDataStore(): Promise<DataStore> {
  if (!globalDataStore) {
    const env = getEnv();
    // Default to MemoryDataStore for ultra-fast, zero-config reliability
    globalDataStore = new MemoryDataStore();
    await globalDataStore.init();
  }
  return globalDataStore;
}
