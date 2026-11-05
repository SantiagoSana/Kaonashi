// KAONASHI PHYGITAL PLATFORM — DATA MODEL TYPES (§11, §5.1)

export type Locale = 'es' | 'en' | 'ja';
export type DisplayCurrency = 'COP' | 'USD' | 'EUR' | 'JPY';
export type AppEnv = 'development' | 'staging' | 'production';

// Staff Roles
export type StaffRole =
  | 'sysmaster'
  | 'kitchen_manager'
  | 'marketing_manager'
  | 'ops_subadmin'
  | 'reception'
  | 'customer';

// Branches
export interface Branch {
  id: string;
  name: string;
  slug: string;
  address: string;
  timezone: string;
  country: string;
  currency: DisplayCurrency;
  taxRate: number; // e.g. 0.08 or 0.19 (for COP/Colombia)
  taxMode: 'inclusive' | 'exclusive';
  hours: string;
  theme: string;
  isPopUp: boolean;
  popUpWindow?: { from: string; to: string };
  attributionConsentMode: 'implied' | 'opt_in';
  createdAt: string;
  updatedAt: string;
}

// User & Auth
export interface StaffUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: StaffRole;
  branchIds: string[];
  passwordHash: string;
  salt: string;
  totpEnabled: boolean;
  totpSecret?: string;
  mfaRequired: boolean;
  googleLoginEnabled: boolean;
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  emailNormalized: string;
  phoneNormalized?: string;
  name: string;
  authProviders: ('google' | 'email_code')[];
  googleSub?: string;
  locale: Locale;
  displayCurrency: DisplayCurrency;
  dietaryFilters?: string[];
  allergens?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  kind: 'customer' | 'staff';
  userId: string;
  role: StaffRole;
  branchIds?: string[];
  email: string;
  name: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
  rotatedFrom?: string;
}

export interface LoginChallenge {
  id: string;
  emailNormalized: string;
  codeHash: string;
  expiresAt: string;
  attemptsLeft: number;
  resendsLeft: number;
  createdAt: string;
}

// FX Rates
export interface FxRate {
  base: DisplayCurrency;
  target: DisplayCurrency;
  rate: number;
  asOf: string;
  isPlaceholder?: boolean;
}

// Menu & Catalog
export type DishCategory =
  | 'nigiri'
  | 'sashimi'
  | 'rolls'
  | 'omakase'
  | 'robata'
  | 'drinks';

export interface MenuItem {
  id: string;
  slug: string;
  category: DishCategory;
  names: { es: string; en: string; ja: string; romaji?: string };
  descriptions: { es: string; en: string; ja: string };
  ingredients: string[];
  allergens: string[]; // crustaceans, soy, sesame, tree nuts, fish, egg, dairy, gluten
  dietary: string[]; // gluten-free, vegan, keto, pregnancy-friendly
  spiceLevel: number; // 0-3
  isRaw: boolean;
  isAlcohol: boolean;
  price: number; // minor units in branch currency
  cost: number;
  imageUrl?: string;
  art: { hue: number; motif: string };
  available: boolean;
  is86?: boolean;
  stock?: number;
  secret?: { tier?: number; phrase?: string };
  branchOverrides?: Record<string, { price?: number; available?: boolean }>;
  modifiers?: { id: string; name: string; priceMinor: number }[];
  pairings?: string[]; // IDs or names of paired drinks
  courseNumber?: number; // for Omakase
}

// Inventory
export interface InventoryLot {
  lotId: string;
  receivedAt: string;
  qty: number;
  expiry: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  onHand: number;
  parLevel: number;
  unitCost: number;
  perishable: boolean;
  shelfLifeDays: number;
  supplier: string;
  lots: InventoryLot[];
}

export interface RecipeLine {
  menuItemId: string;
  sku: string;
  qty: number;
}

// BTL Marketing Entities (§5.1)
export type CampaignObjective = 'awareness' | 'lead_gen' | 'trial' | 'reactivation' | 'event';
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'ended';

export interface Campaign {
  id: string;
  name: string;
  slug: string;
  objective: CampaignObjective;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  budgetMinor: number;
  branchIds: string[];
  languages: Locale[];
  landingPageId?: string;
  fallbackDestination: string; // default /menu
  targetKpis: {
    scans: number;
    leads: number;
    orders: number;
    roas: number;
  };
  targetCostPerOrder: number; // minor units
  floorCostPerOrder: number; // minor units
  createdAt: string;
  updatedAt: string;
}

export type TouchpointType =
  | 'flyer'
  | 'table_tent'
  | 'coaster'
  | 'takeaway_box'
  | 'receipt_insert'
  | 'popup_event'
  | 'street_team'
  | 'partner_venue'
  | 'window_sticker'
  | 'digital_screen';

export interface Touchpoint {
  id: string;
  campaignId: string;
  type: TouchpointType;
  label: string;
  location: string;
  unitsPrinted: number;
  unitCostMinor: number;
  branchId: string;
  impressionsEstimate?: number;
  unitsDistributed?: number;
  promoterId?: string;
  qrMode: 'shared' | 'unique_per_piece';
  tableNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QrCode {
  id: string;
  shortCode: string; // 8 chars Crockford base32
  touchpointId: string;
  campaignId: string;
  destination: string; // internal path
  fallbackDestination?: string;
  signature: string; // HMAC-SHA256(secret, v1|shortCode|touchpointId)
  batchId?: string;
  pieceIndex?: number;
  utm: {
    source: string;
    medium: string;
    campaign: string;
    content: string;
  };
  validFrom: string;
  validTo: string;
  maxScans?: number;
  scansCount: number;
  status: 'active' | 'paused' | 'revoked';
  design: {
    fgColor: string;
    bgColor: string;
    hasLogo: boolean;
    dots: boolean;
  };
  tableNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export type CouponType = 'percent' | 'fixed' | 'free_item' | 'bogo' | 'gift_with_purchase';

export interface Coupon {
  id: string;
  code: string;
  campaignId?: string;
  type: CouponType;
  value: number; // basis points for percent (1500 = 15%), minor units for fixed
  scopeItems?: string[];
  scopeCategories?: DishCategory[];
  minSubtotalMinor: number;
  perCustomerLimit: number;
  totalCap: number;
  redeemedCount: number;
  validFrom: string;
  validTo: string;
  channels: ('online' | 'in_person')[];
  orderTypes: ('dine_in' | 'takeaway' | 'delivery')[];
  stackable: boolean;
  stacksWithLoyalty: boolean;
  freeItemId?: string;
  giftItemId?: string;
  firstOrderOnly: boolean;
  requiresLead: boolean;
  status: 'active' | 'paused' | 'expired';
}

export interface IssuedCode {
  id: string;
  code: string;
  couponId: string;
  qrId?: string;
  leadId?: string;
  status: 'unused' | 'claimed' | 'redeemed' | 'void';
  redeemedAt?: string;
}

export interface CouponClaim {
  id: string;
  couponId: string;
  issuedCodeId?: string;
  walletId: string;
  sessionId: string;
  customerId?: string;
  leadId?: string;
  emailNormalized?: string;
  phoneNormalized?: string;
  attribution: AttributionSnapshot;
  status: 'claimed' | 'redeemed' | 'expired' | 'void';
  claimedAt: string;
  expiresAt: string;
}

export interface CouponRedemption {
  id: string;
  couponId: string;
  claimId?: string;
  orderId?: string;
  channel: 'online' | 'in_person';
  discountMinor: number;
  billAmountMinor?: number;
  posRef?: string;
  staffId?: string;
  redeemedAt: string;
}

export interface Lead {
  id: string;
  campaignId: string;
  qrId?: string;
  name?: string;
  emailNormalized?: string;
  phoneNormalized?: string;
  language: Locale;
  couponClaimId?: string;
  issuedCodeId?: string;
  consent: {
    marketing: boolean;
    privacyVersion: string;
    timestamp: string;
    ipHash: string;
  };
  attribution: AttributionSnapshot;
  status: 'new' | 'coupon_issued' | 'converted' | 'unsubscribed';
  unsubscribedAt?: string;
  erasedAt?: string;
  createdAt: string;
}

export interface ScanEvent {
  id: string;
  qrId: string;
  campaignId: string;
  touchpointId: string;
  timestamp: string;
  sessionId: string;
  ipHash: string;
  deviceClass: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  os: string;
  language: string;
  isUnique: boolean;
  outcome: 'ok' | 'expired' | 'revoked' | 'invalid_signature' | 'rate_limited';
  isDemo?: boolean;
}

export type FunnelEventType =
  | 'scan'
  | 'landing_view'
  | 'engaged'
  | 'cta_click'
  | 'lead_captured'
  | 'coupon_claimed'
  | 'menu_view'
  | 'add_to_cart'
  | 'checkout_started'
  | 'order_completed'
  | 'reservation_completed'
  | 'reorder';

export interface FunnelEvent {
  id: string;
  eventId: string; // UUID idempotency
  sessionId: string;
  type: FunnelEventType;
  campaignId?: string;
  touchpointId?: string;
  orderId?: string;
  valueMinor?: number;
  timestamp: string;
  source: 'client' | 'server';
  isPreview?: boolean;
  isBot?: boolean;
  isDemo?: boolean;
}

export interface AttributionTouch {
  campaignId: string;
  touchpointId: string;
  qrId: string;
  promoterId?: string;
  couponId?: string;
  at: string;
}

export interface AttributionSnapshot {
  first: AttributionTouch | null;
  last: AttributionTouch | null;
  model: 'first_touch' | 'last_touch';
  windowDays: number;
  matchedBy: 'cookie' | 'coupon' | 'lead' | 'none';
  touchAgeHours: number;
}

export interface DistributionLog {
  id: string;
  touchpointId: string;
  date: string;
  quantity: number;
  promoterId?: string;
  note?: string;
  enteredBy: string;
  createdAt: string;
}

export interface CostEntry {
  id: string;
  campaignId: string;
  touchpointId?: string;
  kind: 'print' | 'promoter_fee' | 'venue_fee' | 'media' | 'other';
  amountMinor: number;
  date: string;
  note?: string;
  createdAt: string;
}

export interface StatsDaily {
  id: string; // branchId_campaignId_touchpointId_date
  branchId: string;
  campaignId: string;
  touchpointId: string;
  date: string;
  scans: number;
  uniqueScans: number;
  landingViews: number;
  engaged: number;
  leads: number;
  claims: number;
  addToCart: number;
  checkoutStarted: number;
  orders: number;
  revenueMinor: number;
  discountCostMinor: number;
}

export interface Promoter {
  id: string;
  name: string;
  refCode: string;
  assignedTouchpoints: string[];
  commissionBps: number; // e.g. 500 = 5%
  createdAt: string;
}

export interface OmikujiPrize {
  id: string;
  label: { es: string; en: string; ja: string };
  fortune: '大吉' | '中吉' | '小吉' | '吉' | '末吉';
  poem: { es: string; en: string; ja: string };
  couponCode: string;
  weight: number; // percentage, must sum to 100
  stock: number;
}

export interface OmikujiPlay {
  id: string;
  sessionId: string;
  prizeId: string;
  timestamp: string;
}

// Landing Page Content (§5.6)
export interface LandingPageContent {
  id: string;
  campaignId: string;
  headlineVariants: {
    id: 'A' | 'B';
    headline: { es: string; en: string; ja: string };
    subhead: { es: string; en: string; ja: string };
  }[];
  heroImage?: string;
  ctaText: { es: string; en: string; ja: string };
  offerTitle: { es: string; en: string; ja: string };
  steps: {
    title: { es: string; en: string; ja: string };
    desc: { es: string; en: string; ja: string };
  }[];
  highlightDishIds: string[];
  quotes: { author: string; text: { es: string; en: string; ja: string } }[];
  faq: { q: { es: string; en: string; ja: string }; a: { es: string; en: string; ja: string } }[];
  isPublished: boolean;
}

// Order & KDS Entities (§8.1, §8.2)
export type OrderStatus =
  | 'pending_confirmation'
  | 'received'
  | 'preparing'
  | 'quality_check'
  | 'out_for_delivery'
  | 'ready_for_pickup'
  | 'served'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
export type OrderType = 'dine_in' | 'takeaway' | 'delivery';

export interface OrderItem {
  menuItemId: string;
  name: string;
  priceMinor: number;
  qty: number;
  discountMinor: number;
  selectedModifiers?: { id: string; name: string; priceMinor: number }[];
  specialInstructions?: string;
  isGift?: boolean;
  station: 'sushi' | 'robata' | 'drinks' | 'expo';
}

export interface StationTicket {
  id: string;
  orderId: string;
  station: 'sushi' | 'robata' | 'drinks' | 'expo';
  status: 'pending' | 'started' | 'ready';
  startedAt?: string;
  readyAt?: string;
  bumpedAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  token: string; // unguessable security token for tracking
  branchId: string;
  customerId?: string;
  source: 'online' | 'in_person';
  type: OrderType;
  tableNumber?: string;
  tableSource: 'signed_qr' | 'manual' | 'none';
  guestInfo: {
    name: string;
    phone: string;
    email: string;
    address?: string;
    deliveryInstructions?: string;
    pickupSlot?: string;
  };
  items: OrderItem[];
  subtotalMinor: number;
  discountMinor: number;
  appliedCouponCode?: string;
  deliveryFeeMinor: number;
  serviceChargeMinor: number;
  taxMinor: number;
  tipMinor: number;
  totalMinor: number;
  currencyCharged: DisplayCurrency;
  pointsEarned: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: 'stripe' | 'pay_at_venue';
  attribution: AttributionSnapshot;
  statusHistory: { status: OrderStatus; timestamp: string; note?: string }[];
  stationTickets: StationTicket[];
  createdAt: string;
  updatedAt: string;
  estimatedDeliveryEta?: string;
  deliveryPin?: string;
}

// Reservations (§6.5)
export type ReservationArea = 'main_room' | 'omakase_bar' | 'terrace';
export type ReservationStatus = 'held' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show';

export interface Reservation {
  id: string;
  token: string;
  branchId: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // HH:MM
  partySize: number;
  area: ReservationArea;
  tableId: string;
  seatNumbers?: number[];
  guestInfo: {
    name: string;
    email: string;
    phone: string;
    specialRequests?: string;
  };
  depositAmountMinor: number;
  depositStatus: 'paid' | 'waived' | 'refunded' | 'forfeited';
  status: ReservationStatus;
  holdExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Loyalty (§6.6)
export type LoyaltyTier = 'nigiri_explorer' | 'itamae_vip' | 'omakase_master';

export interface LoyaltyAccount {
  id: string;
  customerId: string;
  pointsBalance: number;
  rolling12mPoints: number;
  tier: LoyaltyTier;
  referralCode: string;
  joinedAt: string;
  updatedAt: string;
}

export interface LoyaltyLedgerEntry {
  id: string;
  accountId: string;
  points: number;
  reason: 'order' | 'welcome' | 'referral' | 'birthday' | 'redemption';
  orderId?: string;
  createdAt: string;
}

// Audit Log (§10.7)
export interface AuditEntry {
  id: string;
  seq: number;
  timestamp: string;
  actor: string;
  role: StaffRole;
  action: string;
  resource: string;
  outcome: 'success' | 'failure' | 'denied';
  ipHash: string;
  details?: Record<string, unknown>;
  before?: unknown;
  after?: unknown;
  prevHash: string;
  hash: string;
}
