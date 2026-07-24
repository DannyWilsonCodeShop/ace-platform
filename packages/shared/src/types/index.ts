// ===========================
// ACE Platform — Shared Types
// ===========================

// === Auth & Roles ===
export type UserRole = 'owner' | 'manager' | 'crew' | 'performer' | 'customer';

export interface User {
  userId: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  createdAt: string;
  lastLogin?: string;
  avatar?: string;
}

// === Quotes ===
export type QuoteStatus = 'new' | 'reviewed' | 'quoted' | 'accepted' | 'declined' | 'expired';
export type ServiceType = 'event' | 'digital';

export interface EventDate {
  date: string;
  startTime: string;
  endTime: string;
}

export interface PerDayDetail {
  services: string[];
  micWireless: string;
  micWired: string;
  auxInputs: string;
  notes: string;
}

export interface Quote {
  quoteId: string;
  serviceType: ServiceType;
  status: QuoteStatus;
  submittedAt: string;
  updatedAt?: string;

  // Contact
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organization?: string;
  howHeard?: string;

  // Event-specific
  eventType?: string;
  eventDates?: EventDate[];
  sameServicesAllDates?: boolean;
  services?: string[];
  perDayDetails?: PerDayDetail[] | null;
  genre?: string;
  speeches?: string;
  budget?: string;
  venueName?: string;
  venueAddress?: string;
  roomName?: string;
  floorAccess?: string;
  indoorOutdoor?: string;
  roomSize?: string;
  powerAvailability?: string;
  loadInTime?: string;
  micWireless?: string;
  micWired?: string;
  auxInputs?: string;
  monitorSpeakers?: string;
  additionalNotes?: string;

  // Digital-specific
  digitalServices?: string[];
  projectDescription?: string;
  hasExisting?: string;
  existingUrl?: string;
  pageCount?: string;
  timeline?: string;
  features?: string[];
  designDirection?: string;
  referenceSites?: string;
  digitalBudget?: string;
  ongoingSupport?: string;
  digitalNotes?: string;

  // Internal (admin-only)
  aiAnalysis?: string;
  internalNotes?: string;
  assignedTo?: string;
  quotedAmount?: number;
  finalAmount?: number;
}

// === Gigs (Confirmed Bookings) ===
export type GigStatus = 'upcoming' | 'confirmed' | 'loaded-in' | 'live' | 'complete' | 'paid' | 'cancelled';

export interface GigChecklist {
  gearPacked: boolean;
  gearLoaded: boolean;
  arrivedAtVenue: boolean;
  setupComplete: boolean;
  soundCheck: boolean;
  eventStarted: boolean;
  eventEnded: boolean;
  gearBrokenDown: boolean;
  gearReturned: boolean;
}

export interface Gig {
  gigId: string;
  quoteId: string; // linked to original quote
  clientId: string;
  status: GigStatus;
  createdAt: string;
  updatedAt?: string;

  // Event details (copied from quote)
  eventType: string;
  eventDates: EventDate[];
  services: string[];
  perDayDetails?: PerDayDetail[] | null;
  venueName: string;
  venueAddress: string;
  roomName?: string;
  floorAccess?: string;
  indoorOutdoor: string;
  roomSize: string;

  // Crew & equipment
  assignedCrew: string[]; // userIds
  equipmentIds: string[]; // equipment item IDs
  checklist: GigChecklist;

  // Financial
  quotedAmount: number;
  depositAmount: number;
  depositPaid: boolean;
  depositPaidAt?: string;
  balanceAmount: number;
  balancePaid: boolean;
  balancePaidAt?: string;
  invoiceId?: string;

  // Notes
  internalNotes?: string;
  clientNotes?: string; // visible to customer
}

// === Clients (CRM) ===
export interface Client {
  clientId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  organization?: string;
  createdAt: string;
  updatedAt?: string;
  totalGigs: number;
  totalRevenue: number;
  isRepeatClient: boolean;
  notes?: string;
  tags?: string[];
  cognitoUserId?: string; // if they have portal access
}

// === Equipment Inventory ===
export type EquipmentCategory = 'speakers' | 'microphones' | 'mixers' | 'cables' | 'stands' | 'monitors' | 'lighting' | 'other';
export type EquipmentStatus = 'available' | 'deployed' | 'maintenance' | 'retired';

export interface Equipment {
  equipmentId: string;
  name: string;
  category: EquipmentCategory;
  brand?: string;
  model?: string;
  serialNumber?: string;
  status: EquipmentStatus;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  purchaseDate?: string;
  purchasePrice?: number;
  notes?: string;
  maintenanceLog?: MaintenanceEntry[];
  currentGigId?: string; // if deployed
}

export interface MaintenanceEntry {
  date: string;
  description: string;
  cost?: number;
}

// === Invoices ===
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  invoiceId: string;
  gigId: string;
  clientId: string;
  status: InvoiceStatus;
  createdAt: string;
  sentAt?: string;
  dueDate: string;
  paidAt?: string;

  lineItems: InvoiceLineItem[];
  subtotal: number;
  discount?: number;
  discountReason?: string;
  tax?: number;
  total: number;

  depositRequired: number;
  depositPaid: number;
  balanceDue: number;

  notes?: string;
  paymentLink?: string; // Stripe payment link
}

// === Crew ===
export interface CrewMember {
  userId: string;
  name: string;
  phone: string;
  email: string;
  role: 'dj' | 'sound-tech' | 'crew' | 'mc' | 'musician' | 'coordinator';
  skills: string[];
  availability: CrewAvailability[];
  hourlyRate?: number;
  totalGigs: number;
}

export interface CrewAvailability {
  date: string;
  available: boolean;
  note?: string;
}

// === Notifications ===
export type NotificationType = 'new-quote' | 'quote-accepted' | 'payment-received' | 'gig-reminder' | 'gig-update' | 'message';
export type NotificationChannel = 'email' | 'sms' | 'in-app';

export interface Notification {
  notificationId: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, string>;
}

// === Subscribers (Email List) ===
export interface Subscriber {
  email: string;
  name?: string;
  source: string;
  subscribedAt: string;
  status: 'active' | 'unsubscribed';
}

// === Messages (Client Communication) ===
export interface Message {
  messageId: string;
  gigId: string;
  senderId: string;
  senderRole: UserRole;
  senderName: string;
  content: string;
  createdAt: string;
  readBy: string[];
}

// === Dashboard Stats ===
export interface DashboardStats {
  newQuotes: number;
  upcomingGigs: number;
  revenueThisMonth: number;
  outstandingBalance: number;
  subscriberCount: number;
  activeClients: number;
}
