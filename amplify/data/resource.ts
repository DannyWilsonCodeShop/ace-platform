import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * ACE Platform Data Schema
 * 
 * This defines:
 * - DynamoDB tables (auto-created)
 * - GraphQL API (auto-generated via AppSync)
 * - Auth rules (who can read/write what)
 * - Relationships between tables
 * 
 * Groups: owner, manager, crew, performer, customer
 */

const schema = a.schema({

  // === Quotes ===
  Quote: a.model({
    serviceType: a.enum(['event', 'digital']),
    status: a.enum(['new', 'reviewed', 'quoted', 'accepted', 'declined', 'expired']),

    // Contact
    firstName: a.string().required(),
    lastName: a.string().required(),
    email: a.string().required(),
    phone: a.string().required(),
    organization: a.string(),
    howHeard: a.string(),

    // Event fields
    eventType: a.string(),
    eventDates: a.json(), // EventDate[]
    sameServicesAllDates: a.boolean(),
    services: a.string().array(),
    perDayDetails: a.json(), // PerDayDetail[]
    genre: a.string(),
    speeches: a.string(),
    budget: a.string(),
    venueName: a.string(),
    venueAddress: a.string(),
    roomName: a.string(),
    floorAccess: a.string(),
    indoorOutdoor: a.string(),
    roomSize: a.string(),
    powerAvailability: a.string(),
    loadInTime: a.string(),
    micWireless: a.string(),
    micWired: a.string(),
    auxInputs: a.string(),
    monitorSpeakers: a.string(),
    additionalNotes: a.string(),

    // Digital fields
    digitalServices: a.string().array(),
    projectDescription: a.string(),
    hasExisting: a.string(),
    existingUrl: a.string(),
    pageCount: a.string(),
    timeline: a.string(),
    features: a.string().array(),
    designDirection: a.string(),
    referenceSites: a.string(),
    digitalBudget: a.string(),
    ongoingSupport: a.string(),
    digitalNotes: a.string(),

    // Internal (admin-only)
    aiAnalysis: a.string(),
    internalNotes: a.string(),
    assignedTo: a.string(),
    quotedAmount: a.float(),
    finalAmount: a.float(),
    source: a.string(),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['crew', 'performer']).to(['read']),
    allow.owner().to(['read']), // customers can see their own
  ]),

  // === Gigs (Confirmed Bookings) ===
  Gig: a.model({
    quoteId: a.string(),
    clientId: a.string().required(),
    status: a.enum(['upcoming', 'confirmed', 'loaded_in', 'live', 'complete', 'paid', 'cancelled']),

    // Event details
    eventType: a.string().required(),
    eventDates: a.json(),
    services: a.string().array(),
    perDayDetails: a.json(),
    venueName: a.string().required(),
    venueAddress: a.string().required(),
    roomName: a.string(),
    floorAccess: a.string(),
    indoorOutdoor: a.string(),
    roomSize: a.string(),

    // Crew & equipment
    assignedCrew: a.string().array(),
    equipmentIds: a.string().array(),
    checklist: a.json(), // GigChecklist

    // Financial
    quotedAmount: a.float(),
    depositAmount: a.float(),
    depositPaid: a.boolean(),
    depositPaidAt: a.string(),
    balanceAmount: a.float(),
    balancePaid: a.boolean(),
    balancePaidAt: a.string(),
    invoiceId: a.string(),

    // Notes
    internalNotes: a.string(),
    clientNotes: a.string(), // visible to customer

    // Relationships
    client: a.belongsTo('Client', 'clientId'),
    messages: a.hasMany('Message', 'gigId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['crew', 'performer']).to(['read', 'update']), // can update checklist
    allow.groups(['customer']).to(['read']), // customers see their own via custom resolver
  ]),

  // === Clients (CRM) ===
  Client: a.model({
    firstName: a.string().required(),
    lastName: a.string().required(),
    email: a.string().required(),
    phone: a.string().required(),
    organization: a.string(),
    totalGigs: a.integer().default(0),
    totalRevenue: a.float().default(0),
    isRepeatClient: a.boolean().default(false),
    notes: a.string(),
    tags: a.string().array(),
    cognitoUserId: a.string(), // linked portal account

    // Relationships
    gigs: a.hasMany('Gig', 'clientId'),
    invoices: a.hasMany('Invoice', 'clientId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['crew']).to(['read']),
  ]),

  // === Equipment Inventory ===
  Equipment: a.model({
    name: a.string().required(),
    category: a.enum(['speakers', 'microphones', 'mixers', 'cables', 'stands', 'monitors', 'lighting', 'other']),
    brand: a.string(),
    model: a.string(),
    serialNumber: a.string(),
    status: a.enum(['available', 'deployed', 'maintenance', 'retired']),
    condition: a.enum(['excellent', 'good', 'fair', 'poor']),
    purchaseDate: a.string(),
    purchasePrice: a.float(),
    notes: a.string(),
    maintenanceLog: a.json(), // MaintenanceEntry[]
    currentGigId: a.string(),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['crew']).to(['read', 'update']),
  ]),

  // === Invoices ===
  Invoice: a.model({
    gigId: a.string(),
    clientId: a.string().required(),
    status: a.enum(['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled']),
    sentAt: a.string(),
    dueDate: a.string().required(),
    paidAt: a.string(),

    lineItems: a.json(), // InvoiceLineItem[]
    subtotal: a.float().required(),
    discount: a.float(),
    discountReason: a.string(),
    tax: a.float(),
    total: a.float().required(),

    depositRequired: a.float(),
    depositPaid: a.float(),
    balanceDue: a.float(),

    notes: a.string(),
    paymentLink: a.string(), // Stripe link

    // Relationships
    client: a.belongsTo('Client', 'clientId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['customer']).to(['read']), // own invoices only via custom logic
  ]),

  // === Crew Members ===
  CrewMember: a.model({
    userId: a.string().required(),
    name: a.string().required(),
    phone: a.string().required(),
    email: a.string().required(),
    role: a.enum(['dj', 'sound_tech', 'crew', 'mc', 'musician', 'coordinator']),
    skills: a.string().array(),
    availability: a.json(), // CrewAvailability[]
    hourlyRate: a.float(),
    totalGigs: a.integer().default(0),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['crew', 'performer']).to(['read', 'update']), // can update own availability
  ]),

  // === Messages (Client Communication) ===
  Message: a.model({
    gigId: a.string().required(),
    senderId: a.string().required(),
    senderRole: a.string().required(),
    senderName: a.string().required(),
    content: a.string().required(),
    readBy: a.string().array(),

    // Relationships
    gig: a.belongsTo('Gig', 'gigId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update']),
    allow.groups(['customer']).to(['create', 'read']), // can send and read messages on their gig
  ]),

  // === Subscribers (Email List) ===
  Subscriber: a.model({
    email: a.string().required(),
    name: a.string(),
    source: a.string(),
    status: a.enum(['active', 'unsubscribed']),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
  ]),

  // === Notifications ===
  Notification: a.model({
    userId: a.string().required(),
    type: a.enum(['new_quote', 'quote_accepted', 'payment_received', 'gig_reminder', 'gig_update', 'message']),
    channel: a.enum(['email', 'sms', 'in_app']),
    title: a.string().required(),
    message: a.string().required(),
    read: a.boolean().default(false),
    metadata: a.json(),
  }).authorization((allow) => [
    allow.owner().to(['read', 'update']),
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
  ]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
