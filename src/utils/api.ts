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
export async function listInvoices() {
  const data = await graphql(`
    query ListInvoices {
      listInvoices(limit: 100) {
        items {
          id gigId clientId status createdAt sentAt dueDate paidAt
          lineItems subtotal discount discountReason total
          depositRequired depositPaid balanceDue notes paymentLink
        }
      }
    }
  `);
  return data?.listInvoices?.items || [];
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
