/**
 * Quote -> Project promotion (the Phase-1 core, design doc §4 stage 4).
 *
 * When an owner/manager Accepts a quote in /quotes/:id this runs the ordered
 * promotion:
 *   1. find the Client by email (listClients) or create one from the quote
 *      contact;
 *   2. provision a customer Cognito portal account via the pre-deployed
 *      create-user API (createPortalUser action 'createCustomer');
 *   3. link Client.cognitoUserId to the customer's Cognito identity and bump
 *      Client.totalProjects;
 *   4. create the Project (status 'contract_pending') from the 'app-build'
 *      template, STAMPING OWNERSHIP to the customer so allow.owner() resolves
 *      when the customer signs in, then seed one ProjectPage per template item;
 *   5. set Quote.status = 'accepted'.
 *
 * OWNERSHIP (design doc §8 / Green-Casting TECH_DEBT #19): the new models use
 * Amplify Gen 2's DEFAULT implicit owner field named `owner`, stored as
 * '<sub>::<username>'. allow.owner() only matches when `owner` is STAMPED AT
 * CREATE. The admin running promotion is NOT the customer, so we must pass the
 * customer's Cognito identity as the `owner` on Project and each seeded
 * ProjectPage. The create-user Lambda returns the customer's Cognito Username
 * (email-based) as `userId`; we stamp that. If the deployed pool ever issues a
 * distinct sub/username pair, stamp '<sub>::<username>' here instead.
 *
 * Guards against double-promotion: if the quote is already 'accepted' the
 * helper throws before mutating anything.
 */

import {
  listClients,
  createClient,
  updateClient,
  createProject,
  createProjectPage,
  updateQuote,
} from '../utils/api';
import { createPortalUser } from '../utils/createPortalUser';
import { getTemplate } from './templates';
import type { TrackedItem } from './templates/types';

interface PromoteResult {
  projectId: string;
  clientId: string;
}

export async function promoteQuote(quote: any): Promise<PromoteResult> {
  if (!quote?.id) throw new Error('Cannot promote: quote is missing.');

  // --- double-promotion guard ---
  if (quote.status === 'accepted') {
    throw new Error('This quote has already been accepted and promoted to a project.');
  }

  const email: string = (quote.email || '').trim();
  if (!email) throw new Error('Cannot promote: the quote has no contact email.');

  const contactName = `${quote.firstName || ''} ${quote.lastName || ''}`.trim() || email;

  // --- (1) find or create the Client ---
  let client: any = null;
  try {
    const clients = await listClients();
    client = (clients || []).find(
      (c: any) => (c.email || '').toLowerCase() === email.toLowerCase(),
    );
  } catch (err: any) {
    throw new Error(`Could not look up existing clients: ${err.message || err}`);
  }

  if (!client) {
    client = await createClient({
      firstName: quote.firstName || contactName,
      lastName: quote.lastName || '',
      email,
      phone: quote.phone || 'N/A',
      organization: quote.organization || null,
    });
    if (!client?.id) throw new Error('Failed to create the client record.');
  }

  // --- (2) provision the customer Cognito portal account ---
  const portal = await createPortalUser({
    action: 'createCustomer',
    email,
    name: contactName,
    phone: quote.phone || undefined,
  });
  if (!portal.success) {
    throw new Error(`Failed to provision the portal account: ${portal.message}`);
  }

  // The create-user Lambda returns the Cognito Username (email-based) as
  // userId. This is the customer's identity we stamp as `owner`.
  const cognitoUserId = portal.userId || email;

  // --- (3) link the Client to the portal account + bump totalProjects ---
  await updateClient({
    id: client.id,
    cognitoUserId,
    totalProjects: (client.totalProjects || 0) + 1,
  });

  // --- (4) create the Project (contract_pending) with ownership stamped ---
  const template = getTemplate('app-build');
  const projectName =
    quote.organization ||
    quote.projectDescription ||
    `${contactName} project`;

  const project = await createProject({
    quoteId: quote.id,
    clientId: client.id,
    name: projectName,
    status: 'contract_pending',
    templateKey: template.key,
    launchStart: template.launch.start,
    launchTarget: template.launch.target,
    backendCeiling: template.backendCeiling,
    quotedAmount:
      quote.quotedAmount != null ? Number(quote.quotedAmount) : null,
    // STAMP OWNERSHIP — so the customer can read their own project (design §8).
    owner: cognitoUserId,
  });
  if (!project?.id) throw new Error('Failed to create the project record.');

  // seed one ProjectPage per template item (frontend/backend/middleware)
  const items: TrackedItem[] = [
    ...template.frontend,
    ...template.backend,
    ...template.middleware,
  ];
  for (const item of items) {
    await createProjectPage({
      projectId: project.id,
      pageKey: item.key,
      label: item.label,
      category: item.category,
      baseline: item.baseline,
      href: item.href || null,
      // stamp ownership on each customer-readable child too
      owner: cognitoUserId,
    });
  }

  // --- (5) mark the quote accepted ---
  await updateQuote({ id: quote.id, status: 'accepted' });

  return { projectId: project.id, clientId: client.id };
}
