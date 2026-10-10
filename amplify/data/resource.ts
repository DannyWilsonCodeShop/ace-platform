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
 * Groups: owner, manager, crew, performer, customer, developer
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
    platform: a.string(),  // target platform for software-build quotes (added)
    clientId: a.string(),  // links an accepted quote to its Client (added)
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
    totalProjects: a.integer().default(0), // counts software-build projects (added)
    totalRevenue: a.float().default(0),
    isRepeatClient: a.boolean().default(false),
    notes: a.string(),
    tags: a.string().array(),
    cognitoUserId: a.string(), // linked portal account

    // --- software-build lifecycle pipeline (added) ---
    // NIT-4: a.enum() cannot carry a DB .default(); the default 'quote_requested'
    // is applied app-side at creation. Pre-existing rows have stage == null and
    // are treated as 'quote_requested' everywhere.
    stage: a.enum(['quote_requested', 'demo_details', 'demo_build', 'agreement', 'payment_setup', 'project', 'post_sale', 'monthly_service']),
    demoAppDetails: a.string(),       // Tab 2 phone-call app scope
    demoRequirements: a.json(),       // Tab 2 structured requirements
    expectedDemoDate: a.date(),       // Tab 2 expected demo delivery
    hasMonthlyMaintenance: a.boolean().default(false), // Tab 8 variant selector

    // Relationships
    gigs: a.hasMany('Gig', 'clientId'),
    invoices: a.hasMany('Invoice', 'clientId'),
    projects: a.hasMany('Project', 'clientId'), // software-build lifecycle
    maintenancePlans: a.hasMany('MaintenancePlan', 'clientId'),
    paymentPlans: a.hasMany('PaymentPlan', 'clientId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['crew']).to(['read']),
    // HIGH-1: the customer portal resolves its own Client row by listing/getting
    // Client and matching cognitoUserId. Group-read carries that access (TD-1
    // over-grant shape; portal UI filters to the signed-in identity's own row).
    allow.groups(['customer']).to(['read']),
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
    projectId: a.string(), // attach deposit/balance/maintenance invoices to a Project (added)
    clientId: a.string().required(),
    status: a.enum(['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled']),
    kind: a.enum(['one_off', 'deposit', 'balance', 'maintenance']), // billing kind (added)
    recurring: a.boolean().default(false), // maintenance subscription invoice (added)
    maintenancePlanId: a.string(), // ties recurring invoices back to a plan (added)
    stripeInvoiceId: a.string(), // mirror of the Stripe invoice (added)
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

  // ===========================================================================
  // === Customer-lifecycle pipeline (software-build) — added, additive only ===
  // ===========================================================================

  // === Project (the software-build lifecycle — new, alongside Gig) ===
  //
  // OWNERSHIP (design doc §8 / Green-Casting TECH_DEBT #1 / TD-1):
  // the implicit `owner` field AUTO-POPULATES to the admin that runs the create
  // mutation — it is NOT a defined CreateXInput field, so do NOT pass `owner`
  // into any CreateProjectInput / CreateProjectPageInput / CreateActionItemInput
  // (passing it is what broke quote Accept with 'field not defined for input
  // object type CreateProjectInput'). Customer reads of their own project (and
  // its child rows) are carried by the `allow.groups(['customer']).to(['read'])`
  // grant below (TD-1), not by allow.owner() stamping at create time.
  Project: a.model({
    quoteId: a.string(),                 // provenance: the Quote it was promoted from
    clientId: a.string().required(),
    name: a.string().required(),         // e.g. "ACE marketing site" / client app name
    status: a.enum([
      'planning', 'contract_pending', 'active', 'in_review', 'maintenance', 'completed', 'closed', 'cancelled',
    ]),
    // --- generalized from the Agency dashboard ---
    templateKey: a.string(),             // which config template seeds ProjectPage rows (§5)
    launchStart: a.date(),               // mirrors config.LAUNCH.start
    launchTarget: a.date(),              // mirrors config.LAUNCH.target (drives progress drip)
    backendCeiling: a.integer().default(65),
    // --- category progress snapshots (denormalized for list views) ---
    frontendProgress: a.integer().default(0),
    backendProgress: a.integer().default(0),
    middlewareProgress: a.integer().default(0),
    overallProgress: a.integer().default(0),
    trackStatus: a.enum(['ontrack', 'atrisk', 'behind']),
    // --- money / provenance ---
    contractId: a.string(),
    quotedAmount: a.float(),
    internalNotes: a.string(),
    clientNotes: a.string(),             // customer-visible
    // --- relationships ---
    client: a.belongsTo('Client', 'clientId'),
    pages: a.hasMany('ProjectPage', 'projectId'),
    actionItems: a.hasMany('ActionItem', 'projectId'),
    notes: a.hasMany('ProjectNote', 'projectId'),
    events: a.hasMany('ProjectEvent', 'projectId'),
    meetings: a.hasMany('Meeting', 'projectId'),
    demos: a.hasMany('Demo', 'projectId'),
    contracts: a.hasMany('Contract', 'projectId'),
    paymentPlans: a.hasMany('PaymentPlan', 'projectId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['developer']).to(['read', 'update']), // builders update project page status
    allow.groups(['customer']).to(['read']),            // own via promotion-stamped ownership
    // Promotion stamps owner = Cognito Username (email). identityClaim pins the
    // owner match to cognito:username instead of the default sub::username, so
    // the stamped value resolves at runtime. (true verification is at deploy.)
    allow.owner().identityClaim('cognito:username').to(['read']),
  ]),

  // === ProjectPage (generalizes DashPageState) ===
  ProjectPage: a.model({
    projectId: a.string().required(),
    pageKey: a.string().required(),      // stable id from the template config
    label: a.string(),
    category: a.enum(['frontend', 'backend', 'middleware']),
    devStatus: a.enum(['NOT_STARTED', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'AWAITING_FEEDBACK', 'COMPLETE']),
    lookComplete: a.boolean().default(false),
    featuresComplete: a.boolean().default(false),
    clientApproval: a.integer().default(0),  // 0-5 star rating
    baseline: a.integer().default(0),
    href: a.string(),
    sortOrder: a.integer().default(0),
    isCustom: a.boolean().default(false),
    project: a.belongsTo('Project', 'projectId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['developer']).to(['read', 'update']),
    // FIELD-SCOPE RISK: customer update is intended ONLY for clientApproval
    // (the 0-5 rating). Amplify group auth is row-level, so this also lets a
    // customer write other fields — field scoping MUST be enforced in the
    // portal UI / a custom resolver (design doc §8 field-level-auth risk).
    allow.groups(['customer']).to(['read', 'update']),
    allow.owner().identityClaim('cognito:username').to(['read']), // stamped at promotion
  ]),

  // === ProjectNote (generalizes DashNote) ===
  ProjectNote: a.model({
    projectId: a.string().required(),
    pageKey: a.string(),
    authorSub: a.string(),               // Cognito sub (replaces honor-system "dan"/"mercedes")
    authorRole: a.string(),              // 'owner' | 'manager' | 'customer' | ...
    kind: a.enum(['VOICE', 'TEXT']),
    body: a.string(),
    audioKey: a.string(),                // S3 path under project/{projectId}/notes/*
    readBy: a.string().array(),          // list of subs who've read/heard it
    project: a.belongsTo('Project', 'projectId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['developer']).to(['create', 'read']),
    allow.groups(['customer']).to(['create', 'read']), // own project only via ownership
    allow.owner().identityClaim('cognito:username').to(['read']), // stamped at promotion
  ]),

  // === ProjectEvent (the daily-log / activity feed) ===
  ProjectEvent: a.model({
    projectId: a.string().required(),
    pageKey: a.string(),
    actor: a.string(),
    message: a.string().required(),
    project: a.belongsTo('Project', 'projectId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['developer']).to(['create', 'read']),
    allow.groups(['customer']).to(['read']),           // read own project log
    allow.owner().identityClaim('cognito:username').to(['read']), // stamped at promotion
  ]),

  // === ActionItem (per-project to-do / task tracker) ===
  ActionItem: a.model({
    projectId: a.string().required(),
    pageKey: a.string(),
    title: a.string().required(),
    detail: a.string(),
    owner_role: a.enum(['client', 'together', 'dev']),
    priority: a.boolean().default(false),
    blocks: a.string(),
    done: a.boolean().default(false),
    completedAt: a.datetime(),
    completedBySub: a.string(),
    assigneeSub: a.string(),
    dueDate: a.date(),
    sortOrder: a.integer().default(0),
    project: a.belongsTo('Project', 'projectId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['developer']).to(['create', 'read', 'update']),
    // FIELD-SCOPE RISK: customer update is intended ONLY for done/completedAt on
    // their own client-owned action items. Amplify group auth is row-level, so
    // this also lets a customer write other fields — field scoping MUST be
    // enforced in the portal UI (design doc §8 field-level-auth risk).
    allow.groups(['customer']).to(['read', 'update']),
    allow.owner().identityClaim('cognito:username').to(['read']), // stamped at promotion
  ]),

  // === Meeting (generalizes DashAppointment; stage 2 "the meeting") ===
  Meeting: a.model({
    projectId: a.string(),               // optional — a pre-sale meeting may precede the project
    quoteId: a.string(),                 // link to the originating quote for stage-2 meetings
    clientId: a.string(),
    requestedBySub: a.string(),
    mode: a.enum(['ZOOM', 'IN_PERSON', 'PHONE']),
    proposedAt: a.datetime(),
    confirmedAt: a.datetime(),
    location: a.string(),
    agenda: a.string(),
    status: a.enum(['REQUESTED', 'ACCEPTED', 'DECLINED', 'RESCHEDULE', 'COMPLETED']),
    responseNote: a.string(),
    purpose: a.enum(['discovery', 'demo_review', 'closing', 'kickoff', 'maintenance', 'other']),
    project: a.belongsTo('Project', 'projectId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['customer']).to(['create', 'read']), // request + read own
    allow.owner().identityClaim('cognito:username').to(['read']), // stamped at promotion
  ]),

  // === Demo (stage 3 "choice board / demo") ===
  Demo: a.model({
    projectId: a.string().required(),
    title: a.string().required(),
    kind: a.enum(['CHOICE_BOARD', 'PROTOTYPE', 'PREVIEW_URL', 'DECK']),
    options: a.json(),                   // choice-board options: [{slug,name,imageKey,previewUrl}]
    previewUrl: a.string(),
    status: a.enum(['DRAFT', 'SHARED', 'FEEDBACK', 'APPROVED']),
    selectedOption: a.string(),          // slug the client picked
    clientFeedback: a.string(),
    project: a.belongsTo('Project', 'projectId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    // FIELD-SCOPE RISK: customer update is intended ONLY for selectedOption /
    // clientFeedback. Row-level group auth also permits other fields — enforce
    // field scoping in the UI / resolver (design doc §8).
    allow.groups(['customer']).to(['read', 'update']),
    allow.owner().identityClaim('cognito:username').to(['read']), // stamped at promotion
  ]),

  // === Contract (stage 5 "contract signing") ===
  Contract: a.model({
    projectId: a.string().required(),
    clientId: a.string().required(),
    status: a.enum(['draft', 'sent', 'viewed', 'signed', 'countersigned', 'void']),
    // DECISION §8 / plan decision 2: manual_upload is fully implemented; the
    // e-sign providers below are TODO seams (no live DocuSign/Dropbox-Sign wiring).
    provider: a.enum(['manual_upload', 'docusign', 'dropbox_sign', 'esignatures_io']),
    documentKey: a.string(),             // S3: clients/{clientId}/contracts/* (unsigned)
    signedDocumentKey: a.string(),       // S3: signed artifact
    providerEnvelopeId: a.string(),      // external e-sign reference, if used
    sentAt: a.datetime(),
    signedAt: a.datetime(),
    amount: a.float(),
    terms: a.json(),
    project: a.belongsTo('Project', 'projectId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['customer']).to(['read']),           // read own
    allow.owner().identityClaim('cognito:username').to(['read']), // stamped at promotion
  ]),

  // === MaintenancePlan (stage 7 recurring billing + booking) ===
  MaintenancePlan: a.model({
    projectId: a.string().required(),
    clientId: a.string().required(),
    status: a.enum(['active', 'paused', 'past_due', 'cancelled']),
    cadence: a.enum(['monthly', 'quarterly', 'annual']),
    amount: a.float().required(),              // e.g. $50-$200/mo hosting, $300-$800/mo retainer
    // TODO (Stripe seam, plan decision 3): populated by the Stripe webhook
    // Lambda — no live Stripe calls in this phase.
    stripeSubscriptionId: a.string(),
    nextBillingDate: a.date(),
    includedHours: a.float(),                  // retainer hours per cycle
    startedAt: a.date(),
    cancelledAt: a.date(),
    client: a.belongsTo('Client', 'clientId'),
    windows: a.hasMany('MaintenanceWindow', 'planId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['customer']).to(['read']),           // read own
    allow.owner().identityClaim('cognito:username').to(['read']), // stamped at promotion
  ]),

  // === MaintenanceWindow ("booking of maintenance windows") ===
  MaintenanceWindow: a.model({
    planId: a.string().required(),
    requestedBySub: a.string(),
    scheduledFor: a.datetime(),
    durationMins: a.integer(),
    description: a.string(),
    status: a.enum(['requested', 'scheduled', 'in_progress', 'done', 'cancelled']),
    hoursUsed: a.float(),
    invoiceId: a.string(),                     // overage billed via Invoice
    plan: a.belongsTo('MaintenancePlan', 'planId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['crew', 'developer']).to(['read', 'update']),
    allow.groups(['customer']).to(['create', 'read']), // book + read own
    allow.owner().identityClaim('cognito:username').to(['read']), // stamped at promotion
  ]),

  // === PaymentPlan (custom payment-plan system — additive, design §A) ===
  PaymentPlan: a.model({
    projectId: a.string().required(),
    clientId: a.string().required(),
    name: a.string().required(),                 // e.g. "Agency Build & Purchase"
    totalAmount: a.float().required(),           // the "to own" total; maintenance excluded
    currency: a.string().default('usd'),
    status: a.enum(['draft', 'active', 'completed', 'defaulted', 'cancelled']),
    ownershipTransfersAtFullPayment: a.boolean().default(true),
    minimumPaymentsOwed: a.integer().default(0),  // installment count floor
    minimumAmountOwed: a.float().default(0),      // dollar floor owed
    licenseEndsOnDefault: a.boolean().default(true),
    stripeScheduleId: a.string(),                 // Stripe subscription_schedule id (installments)
    stripeSubscriptionId: a.string(),             // the subscription the schedule RELEASES (HIGH-2)
    installmentCount: a.integer().default(0),     // total installments; webhook's ONLY source of truth for completion. 0 = "not configured" => NEVER complete (NIT-4)
    installmentsPaidCount: a.integer().default(0),
    minimumMet: a.boolean().default(false),
    defaulted: a.boolean().default(false),
    notes: a.string(),
    // --- deal-shape fields (added, design §3.5) — the dial PRE-FILLS defaults only ---
    dealType: a.enum(['installments', 'lease_to_own', 'buyout', 'custom']),
    buyoutAmount: a.float(),            // dealType=buyout single-charge convenience
    leaseMonthlyAmount: a.float(),      // lease-to-own recurring amount
    leaseTermMonths: a.integer(),       // lease-to-own term
    purchaseOptionAmount: a.float(),    // lease-to-own end-of-term purchase option
    // relationships
    client: a.belongsTo('Client', 'clientId'),
    project: a.belongsTo('Project', 'projectId'),
    items: a.hasMany('PaymentPlanItem', 'planId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['customer']).to(['read']),
    allow.owner().identityClaim('cognito:username').to(['read']),
  ]),

  // === PaymentPlanItem (one row per concrete charge — design §A) ===
  PaymentPlanItem: a.model({
    planId: a.string().required(),
    kind: a.enum(['down_payment', 'installment', 'maintenance', 'buyout', 'lease']),
    sequence: a.integer().required(),            // ordering within the plan
    label: a.string(),                           // "Down payment 1 of 2", "Installment"
    amount: a.float().required(),                // per-charge amount
    dueDate: a.date(),                           // dated one-offs (down_payment)
    // installment-series descriptor fields (used when sequence===0 && kind==='installment')
    cadence: a.enum(['monthly', 'quarterly', 'annual']),
    intervalCount: a.integer(),
    startDate: a.date(),
    anchorDay: a.integer(),                      // bill on the Nth
    count: a.integer(),
    // per-charge state
    status: a.enum(['scheduled', 'invoiced', 'paid', 'failed', 'skipped', 'cancelled']),
    stripeInvoiceId: a.string(),
    hostedInvoiceUrl: a.string(),                // Stripe hosted-invoice pay page (down payments)
    stripePaymentIntentId: a.string(),
    paidAt: a.datetime(),
    // relationship
    plan: a.belongsTo('PaymentPlan', 'planId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
    allow.groups(['customer']).to(['read']),
    allow.owner().identityClaim('cognito:username').to(['read']),
  ]),

  // === Campaign (stage 9 lead gen / drip) ===
  Campaign: a.model({
    name: a.string().required(),
    trigger: a.enum(['quote_declined', 'project_closed', 'manual', 'subscribe']),
    status: a.enum(['draft', 'active', 'paused', 'archived']),
    steps: a.hasMany('CampaignStep', 'campaignId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
  ]),

  // === CampaignStep ===
  CampaignStep: a.model({
    campaignId: a.string().required(),
    order: a.integer().required(),
    delayDays: a.integer().default(0),
    channel: a.enum(['email', 'sms']),
    subject: a.string(),
    bodyTemplate: a.string(),
    campaign: a.belongsTo('Campaign', 'campaignId'),
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
  ]),

  // === ContactAttempt (Tab 1 contact log — design §3.3) ===
  // Internal CRM log — NOT customer-visible. No customer grant.
  ContactAttempt: a.model({
    clientId: a.string().required(),
    quoteId: a.string(),
    method: a.enum(['phone', 'email', 'sms', 'voicemail', 'meeting', 'other']),
    outcome: a.enum(['no_answer', 'left_message', 'connected', 'scheduled', 'declined', 'other']),
    occurredAt: a.datetime().required(),  // admin-entered attempt date/time
    notes: a.string(),
    createdBySub: a.string(),             // Cognito sub of the admin logging it
  }).authorization((allow) => [
    allow.groups(['owner', 'manager']).to(['create', 'read', 'update', 'delete']),
  ]),

  // === MonthlyChecklistState (Tab 8 persisted completion — design §3.4) ===
  // Template is code-defined; only completion state persists per client per month.
  // One row per client per month is enforced app-side (query by clientId + period).
  MonthlyChecklistState: a.model({
    clientId: a.string().required(),
    period: a.string().required(),        // 'YYYY-MM' the checklist month
    variant: a.enum(['with_maintenance', 'without_maintenance']),
    completedItemKeys: a.string().array(), // keys from the code template that are ticked
    notes: a.string(),
    updatedBySub: a.string(),
  }).authorization((allow) => [
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
