// ===========================
// ACE Platform — Constants
// ===========================

export const QUOTE_STATUS_LABELS: Record<string, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  quoted: 'Quote Sent',
  accepted: 'Accepted',
  declined: 'Declined',
  expired: 'Expired',
};

export const GIG_STATUS_LABELS: Record<string, string> = {
  upcoming: 'Upcoming',
  confirmed: 'Confirmed',
  'loaded-in': 'Loaded In',
  live: 'Live',
  complete: 'Complete',
  paid: 'Paid',
  cancelled: 'Cancelled',
};

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  partial: 'Partially Paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

export const ROLE_PERMISSIONS = {
  owner: {
    quotes: ['read', 'write', 'delete'],
    gigs: ['read', 'write', 'delete'],
    clients: ['read', 'write', 'delete'],
    equipment: ['read', 'write', 'delete'],
    invoices: ['read', 'write', 'delete', 'send'],
    crew: ['read', 'write', 'delete'],
    subscribers: ['read', 'write', 'delete', 'send'],
    notifications: ['read', 'write', 'configure'],
    settings: ['read', 'write'],
  },
  manager: {
    quotes: ['read', 'write'],
    gigs: ['read', 'write'],
    clients: ['read', 'write'],
    equipment: ['read', 'write'],
    invoices: ['read', 'write', 'send'],
    crew: ['read', 'write'],
    subscribers: ['read'],
    notifications: ['read'],
    settings: ['read'],
  },
  crew: {
    quotes: [],
    gigs: ['read'], // only assigned gigs
    clients: [],
    equipment: ['read'],
    invoices: [],
    crew: ['read'], // only own profile
    subscribers: [],
    notifications: ['read'],
    settings: [],
  },
  performer: {
    quotes: [],
    gigs: ['read'], // only assigned gigs
    clients: [],
    equipment: [],
    invoices: [],
    crew: ['read'], // only own profile
    subscribers: [],
    notifications: ['read'],
    settings: [],
  },
  customer: {
    quotes: ['read'], // only own quotes
    gigs: ['read'], // only own gigs
    clients: [],
    equipment: [],
    invoices: ['read'], // only own invoices
    crew: [],
    subscribers: [],
    notifications: ['read'],
    settings: [],
  },
} as const;

export const SERVICES = [
  'DJ',
  'PA System',
  'Live Band',
  'Event Hosting',
] as const;

export const EQUIPMENT_CATEGORIES = [
  'speakers',
  'microphones',
  'mixers',
  'cables',
  'stands',
  'monitors',
  'lighting',
  'other',
] as const;

export const ROOM_SIZES = [
  { value: 'Small', label: 'Small', capacity: 'Up to 30', sqft: '~500–1,000 sq ft' },
  { value: 'Small-Medium', label: 'Small-Medium', capacity: '30–75', sqft: '~1,000–2,500 sq ft' },
  { value: 'Medium', label: 'Medium', capacity: '75–200', sqft: '~2,500–5,000 sq ft' },
  { value: 'Medium-Large', label: 'Medium-Large', capacity: '200–500', sqft: '~5,000–15,000 sq ft' },
  { value: 'Large', label: 'Large', capacity: '500+', sqft: '15,000+ sq ft' },
] as const;
