/**
 * Direct AppSync GraphQL client.
 * Bypasses the aws-amplify Data client which crashes on Gen 2 groups format.
 * Uses fetch + auth token from Cognito session.
 */

import { fetchAuthSession } from 'aws-amplify/auth';
import outputs from '../../amplify_outputs.json';

const GRAPHQL_ENDPOINT = (outputs as any).data?.url || '';

async function getAuthToken(): Promise<string> {
  const session = await fetchAuthSession();
  return session.tokens?.accessToken?.toString() || '';
}

export async function graphql(query: string, variables?: Record<string, any>) {
  const token = await getAuthToken();

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token,
    },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();

  if (result.errors) {
    console.error('GraphQL errors:', result.errors);
    throw new Error(result.errors[0]?.message || 'GraphQL error');
  }

  return result.data;
}

// === Quote queries ===
export async function listQuotes() {
  const data = await graphql(`
    query ListQuotes {
      listQuotes(limit: 100) {
        items {
          id serviceType status createdAt updatedAt
          firstName lastName email phone organization howHeard
          eventType eventDates sameServicesAllDates services perDayDetails
          genre speeches budget venueName venueAddress roomName
          floorAccess indoorOutdoor roomSize powerAvailability loadInTime
          micWireless micWired auxInputs monitorSpeakers additionalNotes
          digitalServices projectDescription hasExisting existingUrl
          pageCount timeline features designDirection referenceSites
          digitalBudget ongoingSupport digitalNotes
          aiAnalysis internalNotes assignedTo quotedAmount finalAmount source
        }
      }
    }
  `);
  return data?.listQuotes?.items || [];
}

export async function getQuote(id: string) {
  const data = await graphql(`
    query GetQuote($id: ID!) {
      getQuote(id: $id) {
        id serviceType status createdAt updatedAt
        firstName lastName email phone organization howHeard
        eventType eventDates sameServicesAllDates services perDayDetails
        genre speeches budget venueName venueAddress roomName
        floorAccess indoorOutdoor roomSize powerAvailability loadInTime
        micWireless micWired auxInputs monitorSpeakers additionalNotes
        digitalServices projectDescription hasExisting existingUrl
        pageCount timeline features designDirection referenceSites
        digitalBudget ongoingSupport digitalNotes
        aiAnalysis internalNotes assignedTo quotedAmount finalAmount source
      }
    }
  `, { id });
  return data?.getQuote;
}

export async function updateQuote(input: Record<string, any>) {
  const data = await graphql(`
    mutation UpdateQuote($input: UpdateQuoteInput!) {
      updateQuote(input: $input) {
        id status internalNotes quotedAmount
      }
    }
  `, { input });
  return data?.updateQuote;
}


// === Gig queries ===
export async function listGigs() {
  const data = await graphql(`
    query ListGigs {
      listGigs(limit: 100) {
        items {
          id quoteId clientId status createdAt updatedAt
          eventType eventDates services perDayDetails
          venueName venueAddress roomName floorAccess indoorOutdoor roomSize
          assignedCrew equipmentIds checklist
          quotedAmount depositAmount depositPaid depositPaidAt
          balanceAmount balancePaid balancePaidAt invoiceId
          internalNotes clientNotes
        }
      }
    }
  `);
  return data?.listGigs?.items || [];
}

export async function getGig(id: string) {
  const data = await graphql(`
    query GetGig($id: ID!) {
      getGig(id: $id) {
        id quoteId clientId status createdAt updatedAt
        eventType eventDates services perDayDetails
        venueName venueAddress roomName floorAccess indoorOutdoor roomSize
        assignedCrew equipmentIds checklist
        quotedAmount depositAmount depositPaid depositPaidAt
        balanceAmount balancePaid balancePaidAt invoiceId
        internalNotes clientNotes
      }
    }
  `, { id });
  return data?.getGig;
}

export async function updateGig(input: Record<string, any>) {
  const data = await graphql(`
    mutation UpdateGig($input: UpdateGigInput!) {
      updateGig(input: $input) { id status checklist }
    }
  `, { input });
  return data?.updateGig;
}

// === Client queries ===
export async function listClients() {
  const data = await graphql(`
    query ListClients {
      listClients(limit: 100) {
        items {
          id firstName lastName email phone organization
          totalGigs totalRevenue isRepeatClient notes tags createdAt
        }
      }
    }
  `);
  return data?.listClients?.items || [];
}

export async function createClient(input: Record<string, any>) {
  const data = await graphql(`
    mutation CreateClient($input: CreateClientInput!) {
      createClient(input: $input) { id firstName lastName email }
    }
  `, { input });
  return data?.createClient;
}

export async function getClient(id: string) {
  const data = await graphql(`
    query GetClient($id: ID!) {
      getClient(id: $id) {
        id firstName lastName email phone organization
        totalGigs totalProjects totalRevenue isRepeatClient
        notes tags cognitoUserId createdAt
      }
    }
  `, { id });
  return data?.getClient;
}

export async function updateClient(input: Record<string, any>) {
  const data = await graphql(`
    mutation UpdateClient($input: UpdateClientInput!) {
      updateClient(input: $input) {
        id cognitoUserId totalProjects
      }
    }
  `, { input });
  return data?.updateClient;
}

// === Equipment queries ===
export async function listEquipment() {
  const data = await graphql(`
    query ListEquipment {
      listEquipment(limit: 200) {
        items {
          id name category brand model serialNumber
          status condition purchaseDate purchasePrice notes currentGigId
        }
      }
    }
  `);
  return data?.listEquipment?.items || [];
}

export async function createEquipment(input: Record<string, any>) {
  const data = await graphql(`
    mutation CreateEquipment($input: CreateEquipmentInput!) {
      createEquipment(input: $input) { id name category status }
    }
  `, { input });
  return data?.createEquipment;
}

// === Invoice queries ===
const INVOICE_FIELDS = `
  id gigId projectId clientId status kind recurring maintenancePlanId stripeInvoiceId
  sentAt dueDate paidAt lineItems subtotal discount discountReason tax total
  depositRequired depositPaid balanceDue notes paymentLink createdAt updatedAt
`;

export async function listInvoices() {
  const data = await graphql(`
    query ListInvoices {
      listInvoices(limit: 100) {
        items { ${INVOICE_FIELDS} }
      }
    }
  `);
  return data?.listInvoices?.items || [];
}

export async function createInvoice(input: Record<string, any>) {
  const data = await graphql(`
    mutation CreateInvoice($input: CreateInvoiceInput!) {
      createInvoice(input: $input) { ${INVOICE_FIELDS} }
    }
  `, { input });
  return data?.createInvoice;
}

export async function updateInvoice(input: Record<string, any>) {
  const data = await graphql(`
    mutation UpdateInvoice($input: UpdateInvoiceInput!) {
      updateInvoice(input: $input) { ${INVOICE_FIELDS} }
    }
  `, { input });
  return data?.updateInvoice;
}

// === Crew queries ===
export async function listCrew() {
  const data = await graphql(`
    query ListCrewMembers {
      listCrewMembers(limit: 100) {
        items {
          id userId name phone email role skills hourlyRate totalGigs
        }
      }
    }
  `);
  return data?.listCrewMembers?.items || [];
}

export async function createCrewMember(input: Record<string, any>) {
  const data = await graphql(`
    mutation CreateCrewMember($input: CreateCrewMemberInput!) {
      createCrewMember(input: $input) { id name role }
    }
  `, { input });
  return data?.createCrewMember;
}

// === Subscriber queries ===
export async function listSubscribers() {
  const data = await graphql(`
    query ListSubscribers {
      listSubscribers(limit: 500) {
        items {
          id email name source status createdAt
        }
      }
    }
  `);
  return data?.listSubscribers?.items || [];
}

// === Project queries ===
const PROJECT_FIELDS = `
  id quoteId clientId name status templateKey
  launchStart launchTarget backendCeiling
  frontendProgress backendProgress middlewareProgress overallProgress trackStatus
  contractId quotedAmount internalNotes clientNotes owner createdAt updatedAt
`;

export async function createProject(input: Record<string, any>) {
  const data = await graphql(`
    mutation CreateProject($input: CreateProjectInput!) {
      createProject(input: $input) { ${PROJECT_FIELDS} }
    }
  `, { input });
  return data?.createProject;
}

export async function getProject(id: string) {
  const data = await graphql(`
    query GetProject($id: ID!) {
      getProject(id: $id) { ${PROJECT_FIELDS} }
    }
  `, { id });
  return data?.getProject;
}

export async function listProjects() {
  const data = await graphql(`
    query ListProjects {
      listProjects(limit: 200) {
        items { ${PROJECT_FIELDS} }
      }
    }
  `);
  return data?.listProjects?.items || [];
}

export async function updateProject(input: Record<string, any>) {
  const data = await graphql(`
    mutation UpdateProject($input: UpdateProjectInput!) {
      updateProject(input: $input) { ${PROJECT_FIELDS} }
    }
  `, { input });
  return data?.updateProject;
}

// === ProjectPage queries ===
const PROJECT_PAGE_FIELDS = `
  id projectId pageKey label category devStatus
  lookComplete featuresComplete clientApproval baseline href owner createdAt updatedAt
`;

export async function createProjectPage(input: Record<string, any>) {
  const data = await graphql(`
    mutation CreateProjectPage($input: CreateProjectPageInput!) {
      createProjectPage(input: $input) { ${PROJECT_PAGE_FIELDS} }
    }
  `, { input });
  return data?.createProjectPage;
}

export async function listProjectPages(projectId: string) {
  const data = await graphql(`
    query ListProjectPages($filter: ModelProjectPageFilterInput) {
      listProjectPages(filter: $filter, limit: 200) {
        items { ${PROJECT_PAGE_FIELDS} }
      }
    }
  `, { filter: { projectId: { eq: projectId } } });
  return data?.listProjectPages?.items || [];
}

export async function updateProjectPage(input: Record<string, any>) {
  const data = await graphql(`
    mutation UpdateProjectPage($input: UpdateProjectPageInput!) {
      updateProjectPage(input: $input) { ${PROJECT_PAGE_FIELDS} }
    }
  `, { input });
  return data?.updateProjectPage;
}

// === ProjectNote queries ===
const PROJECT_NOTE_FIELDS = `
  id projectId pageKey authorSub authorRole kind body audioKey readBy owner createdAt updatedAt
`;

export async function createProjectNote(input: Record<string, any>) {
  const data = await graphql(`
    mutation CreateProjectNote($input: CreateProjectNoteInput!) {
      createProjectNote(input: $input) { ${PROJECT_NOTE_FIELDS} }
    }
  `, { input });
  return data?.createProjectNote;
}

export async function listProjectNotes(projectId: string) {
  const data = await graphql(`
    query ListProjectNotes($filter: ModelProjectNoteFilterInput) {
      listProjectNotes(filter: $filter, limit: 200) {
        items { ${PROJECT_NOTE_FIELDS} }
      }
    }
  `, { filter: { projectId: { eq: projectId } } });
  return data?.listProjectNotes?.items || [];
}

// === ProjectEvent queries ===
const PROJECT_EVENT_FIELDS = `
  id projectId pageKey actor message owner createdAt updatedAt
`;

export async function createProjectEvent(input: Record<string, any>) {
  const data = await graphql(`
    mutation CreateProjectEvent($input: CreateProjectEventInput!) {
      createProjectEvent(input: $input) { ${PROJECT_EVENT_FIELDS} }
    }
  `, { input });
  return data?.createProjectEvent;
}

export async function listProjectEvents(projectId: string) {
  const data = await graphql(`
    query ListProjectEvents($filter: ModelProjectEventFilterInput) {
      listProjectEvents(filter: $filter, limit: 200) {
        items { ${PROJECT_EVENT_FIELDS} }
      }
    }
  `, { filter: { projectId: { eq: projectId } } });
  return data?.listProjectEvents?.items || [];
}

// === Meeting queries ===
const MEETING_FIELDS = `
  id projectId quoteId clientId requestedBySub mode
  proposedAt confirmedAt location agenda status responseNote purpose
  owner createdAt updatedAt
`;

export async function createMeeting(input: Record<string, any>) {
  const data = await graphql(`
    mutation CreateMeeting($input: CreateMeetingInput!) {
      createMeeting(input: $input) { ${MEETING_FIELDS} }
    }
  `, { input });
  return data?.createMeeting;
}

export async function listMeetings(projectId: string) {
  const data = await graphql(`
    query ListMeetings($filter: ModelMeetingFilterInput) {
      listMeetings(filter: $filter, limit: 200) {
        items { ${MEETING_FIELDS} }
      }
    }
  `, { filter: { projectId: { eq: projectId } } });
  return data?.listMeetings?.items || [];
}

export async function updateMeeting(input: Record<string, any>) {
  const data = await graphql(`
    mutation UpdateMeeting($input: UpdateMeetingInput!) {
      updateMeeting(input: $input) { ${MEETING_FIELDS} }
    }
  `, { input });
  return data?.updateMeeting;
}

// === Demo queries ===
const DEMO_FIELDS = `
  id projectId title kind options previewUrl status selectedOption clientFeedback
  owner createdAt updatedAt
`;

export async function createDemo(input: Record<string, any>) {
  const data = await graphql(`
    mutation CreateDemo($input: CreateDemoInput!) {
      createDemo(input: $input) { ${DEMO_FIELDS} }
    }
  `, { input });
  return data?.createDemo;
}

export async function listDemos(projectId: string) {
  const data = await graphql(`
    query ListDemos($filter: ModelDemoFilterInput) {
      listDemos(filter: $filter, limit: 200) {
        items { ${DEMO_FIELDS} }
      }
    }
  `, { filter: { projectId: { eq: projectId } } });
  return data?.listDemos?.items || [];
}

export async function updateDemo(input: Record<string, any>) {
  const data = await graphql(`
    mutation UpdateDemo($input: UpdateDemoInput!) {
      updateDemo(input: $input) { ${DEMO_FIELDS} }
    }
  `, { input });
  return data?.updateDemo;
}

// === Contract queries ===
const CONTRACT_FIELDS = `
  id projectId clientId status provider
  documentKey signedDocumentKey providerEnvelopeId
  sentAt signedAt amount terms owner createdAt updatedAt
`;

export async function createContract(input: Record<string, any>) {
  const data = await graphql(`
    mutation CreateContract($input: CreateContractInput!) {
      createContract(input: $input) { ${CONTRACT_FIELDS} }
    }
  `, { input });
  return data?.createContract;
}

export async function getContract(projectId: string) {
  const data = await graphql(`
    query ListContracts($filter: ModelContractFilterInput) {
      listContracts(filter: $filter, limit: 50) {
        items { ${CONTRACT_FIELDS} }
      }
    }
  `, { filter: { projectId: { eq: projectId } } });
  return data?.listContracts?.items || [];
}

export async function updateContract(input: Record<string, any>) {
  const data = await graphql(`
    mutation UpdateContract($input: UpdateContractInput!) {
      updateContract(input: $input) { ${CONTRACT_FIELDS} }
    }
  `, { input });
  return data?.updateContract;
}

// === MaintenancePlan queries ===
const MAINTENANCE_PLAN_FIELDS = `
  id projectId clientId status cadence amount stripeSubscriptionId
  nextBillingDate includedHours startedAt cancelledAt owner createdAt updatedAt
`;

export async function createMaintenancePlan(input: Record<string, any>) {
  const data = await graphql(`
    mutation CreateMaintenancePlan($input: CreateMaintenancePlanInput!) {
      createMaintenancePlan(input: $input) { ${MAINTENANCE_PLAN_FIELDS} }
    }
  `, { input });
  return data?.createMaintenancePlan;
}

export async function getMaintenancePlan(id: string) {
  const data = await graphql(`
    query GetMaintenancePlan($id: ID!) {
      getMaintenancePlan(id: $id) { ${MAINTENANCE_PLAN_FIELDS} }
    }
  `, { id });
  return data?.getMaintenancePlan;
}

export async function listMaintenancePlansByProject(projectId: string) {
  const data = await graphql(`
    query ListMaintenancePlans($filter: ModelMaintenancePlanFilterInput) {
      listMaintenancePlans(filter: $filter, limit: 200) {
        items { ${MAINTENANCE_PLAN_FIELDS} }
      }
    }
  `, { filter: { projectId: { eq: projectId } } });
  return data?.listMaintenancePlans?.items || [];
}

export async function listMaintenancePlansByClient(clientId: string) {
  const data = await graphql(`
    query ListMaintenancePlans($filter: ModelMaintenancePlanFilterInput) {
      listMaintenancePlans(filter: $filter, limit: 200) {
        items { ${MAINTENANCE_PLAN_FIELDS} }
      }
    }
  `, { filter: { clientId: { eq: clientId } } });
  return data?.listMaintenancePlans?.items || [];
}

export async function updateMaintenancePlan(input: Record<string, any>) {
  const data = await graphql(`
    mutation UpdateMaintenancePlan($input: UpdateMaintenancePlanInput!) {
      updateMaintenancePlan(input: $input) { ${MAINTENANCE_PLAN_FIELDS} }
    }
  `, { input });
  return data?.updateMaintenancePlan;
}

// === MaintenanceWindow queries ===
const MAINTENANCE_WINDOW_FIELDS = `
  id planId requestedBySub scheduledFor durationMins description status
  hoursUsed invoiceId createdAt updatedAt
`;

export async function createMaintenanceWindow(input: Record<string, any>) {
  const data = await graphql(`
    mutation CreateMaintenanceWindow($input: CreateMaintenanceWindowInput!) {
      createMaintenanceWindow(input: $input) { ${MAINTENANCE_WINDOW_FIELDS} }
    }
  `, { input });
  return data?.createMaintenanceWindow;
}

export async function listMaintenanceWindowsByPlan(planId: string) {
  const data = await graphql(`
    query ListMaintenanceWindows($filter: ModelMaintenanceWindowFilterInput) {
      listMaintenanceWindows(filter: $filter, limit: 200) {
        items { ${MAINTENANCE_WINDOW_FIELDS} }
      }
    }
  `, { filter: { planId: { eq: planId } } });
  return data?.listMaintenanceWindows?.items || [];
}

export async function updateMaintenanceWindow(input: Record<string, any>) {
  const data = await graphql(`
    mutation UpdateMaintenanceWindow($input: UpdateMaintenanceWindowInput!) {
      updateMaintenanceWindow(input: $input) { ${MAINTENANCE_WINDOW_FIELDS} }
    }
  `, { input });
  return data?.updateMaintenanceWindow;
}

// === Campaign queries ===
const CAMPAIGN_FIELDS = `
  id name trigger status createdAt updatedAt
`;

export async function createCampaign(input: Record<string, any>) {
  const data = await graphql(`
    mutation CreateCampaign($input: CreateCampaignInput!) {
      createCampaign(input: $input) { ${CAMPAIGN_FIELDS} }
    }
  `, { input });
  return data?.createCampaign;
}

export async function listCampaigns() {
  const data = await graphql(`
    query ListCampaigns {
      listCampaigns(limit: 200) {
        items { ${CAMPAIGN_FIELDS} }
      }
    }
  `);
  return data?.listCampaigns?.items || [];
}

export async function updateCampaign(input: Record<string, any>) {
  const data = await graphql(`
    mutation UpdateCampaign($input: UpdateCampaignInput!) {
      updateCampaign(input: $input) { ${CAMPAIGN_FIELDS} }
    }
  `, { input });
  return data?.updateCampaign;
}

// === CampaignStep queries ===
const CAMPAIGN_STEP_FIELDS = `
  id campaignId order delayDays channel subject bodyTemplate createdAt updatedAt
`;

export async function createCampaignStep(input: Record<string, any>) {
  const data = await graphql(`
    mutation CreateCampaignStep($input: CreateCampaignStepInput!) {
      createCampaignStep(input: $input) { ${CAMPAIGN_STEP_FIELDS} }
    }
  `, { input });
  return data?.createCampaignStep;
}

export async function listCampaignStepsByCampaign(campaignId: string) {
  const data = await graphql(`
    query ListCampaignSteps($filter: ModelCampaignStepFilterInput) {
      listCampaignSteps(filter: $filter, limit: 200) {
        items { ${CAMPAIGN_STEP_FIELDS} }
      }
    }
  `, { filter: { campaignId: { eq: campaignId } } });
  return data?.listCampaignSteps?.items || [];
}

export async function updateCampaignStep(input: Record<string, any>) {
  const data = await graphql(`
    mutation UpdateCampaignStep($input: UpdateCampaignStepInput!) {
      updateCampaignStep(input: $input) { ${CAMPAIGN_STEP_FIELDS} }
    }
  `, { input });
  return data?.updateCampaignStep;
}

// === PaymentPlan queries ===
const PAYMENT_PLAN_FIELDS = `
  id projectId clientId name totalAmount currency status
  ownershipTransfersAtFullPayment minimumPaymentsOwed minimumAmountOwed
  licenseEndsOnDefault stripeScheduleId stripeSubscriptionId
  installmentCount installmentsPaidCount minimumMet defaulted notes
  owner createdAt updatedAt
`;

export async function createPaymentPlan(input: Record<string, any>) {
  const data = await graphql(`
    mutation CreatePaymentPlan($input: CreatePaymentPlanInput!) {
      createPaymentPlan(input: $input) { ${PAYMENT_PLAN_FIELDS} }
    }
  `, { input });
  return data?.createPaymentPlan;
}

export async function getPaymentPlan(id: string) {
  const data = await graphql(`
    query GetPaymentPlan($id: ID!) {
      getPaymentPlan(id: $id) { ${PAYMENT_PLAN_FIELDS} }
    }
  `, { id });
  return data?.getPaymentPlan;
}

export async function listPaymentPlansByProject(projectId: string) {
  const data = await graphql(`
    query ListPaymentPlans($filter: ModelPaymentPlanFilterInput) {
      listPaymentPlans(filter: $filter, limit: 200) {
        items { ${PAYMENT_PLAN_FIELDS} }
      }
    }
  `, { filter: { projectId: { eq: projectId } } });
  return data?.listPaymentPlans?.items || [];
}

export async function updatePaymentPlan(input: Record<string, any>) {
  const data = await graphql(`
    mutation UpdatePaymentPlan($input: UpdatePaymentPlanInput!) {
      updatePaymentPlan(input: $input) { ${PAYMENT_PLAN_FIELDS} }
    }
  `, { input });
  return data?.updatePaymentPlan;
}

// === PaymentPlanItem queries ===
const PAYMENT_PLAN_ITEM_FIELDS = `
  id planId kind sequence label amount dueDate
  cadence intervalCount startDate anchorDay count status
  stripeInvoiceId stripePaymentIntentId paidAt owner createdAt updatedAt
`;

export async function createPaymentPlanItem(input: Record<string, any>) {
  const data = await graphql(`
    mutation CreatePaymentPlanItem($input: CreatePaymentPlanItemInput!) {
      createPaymentPlanItem(input: $input) { ${PAYMENT_PLAN_ITEM_FIELDS} }
    }
  `, { input });
  return data?.createPaymentPlanItem;
}

export async function listPaymentPlanItemsByPlan(planId: string) {
  const data = await graphql(`
    query ListPaymentPlanItems($filter: ModelPaymentPlanItemFilterInput) {
      listPaymentPlanItems(filter: $filter, limit: 200) {
        items { ${PAYMENT_PLAN_ITEM_FIELDS} }
      }
    }
  `, { filter: { planId: { eq: planId } } });
  return data?.listPaymentPlanItems?.items || [];
}

export async function updatePaymentPlanItem(input: Record<string, any>) {
  const data = await graphql(`
    mutation UpdatePaymentPlanItem($input: UpdatePaymentPlanItemInput!) {
      updatePaymentPlanItem(input: $input) { ${PAYMENT_PLAN_ITEM_FIELDS} }
    }
  `, { input });
  return data?.updatePaymentPlanItem;
}
