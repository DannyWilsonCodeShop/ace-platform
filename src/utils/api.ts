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
