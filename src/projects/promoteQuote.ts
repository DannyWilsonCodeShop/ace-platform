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
 *      template, then seed one ProjectPage per template item;
 *   5. set Quote.status = 'accepted'.
 *
 * OWNERSHIP (design doc §8 / Green-Casting TECH_DEBT #1): the `owner` field
 * auto-populates to the admin mutation caller — do NOT pass `owner` into any
 * CreateXInput (it is not a defined input field, and passing it is what broke
 * quote Accept with 'field not defined for input object type
 * CreateProjectInput'). Customer reads of their own project are carried by the
 * `allow.groups(['customer']).to(['read'])` grant (TD-1), not by allow.owner()
 * stamping at create.
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
import type { ProjectTemplate, TrackedItem } from './templates/types';

interface PromoteResult {
  projectId: string;
  clientId: string;
}

/**
 * Pure builder for the createProject input used by the promotion path.
 * Extracted so it can be unit-tested without any network. MUST NOT include an
 * `owner` key — `owner` is not a defined CreateProjectInput field (TD-1).
 */
export function buildProjectInput(args: {
  quoteId: string;
  clientId: string;
  name: string;
  template: ProjectTemplate;
  quotedAmount: number | null;
}): Record<string, any> {
  const { quoteId, clientId, name, template, quotedAmount } = args;
  return {
    quoteId,
    clientId,
    name,
    status: 'contract_pending',
    templateKey: template.key,
    launchStart: template.launch.start,
    launchTarget: template.launch.target,
    backendCeiling: template.backendCeiling,
    quotedAmount: quotedAmount != null ? Number(quotedAmount) : null,
  };
}

/**
 * Pure builder for a single createProjectPage input seeded from a template
 * item. Like buildProjectInput, it MUST NOT include an `owner` key (TD-1).
 */
export function buildProjectPageInput(
  projectId: string,
  item: TrackedItem,
): Record<string, any> {
  return {
    projectId,
    pageKey: item.key,
    label: item.label,
    category: item.category,
    baseline: item.baseline,
    href: item.href || null,
  };
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
  // userId. This links the Client to the portal account (step 3 below); it is
  // NOT stamped as `owner` on any create input (TD-1).
  const cognitoUserId = portal.userId || email;

  // --- (3) link the Client to the portal account + bump totalProjects ---
  await updateClient({
    id: client.id,
    cognitoUserId,
    totalProjects: (client.totalProjects || 0) + 1,
  });

  // --- (4) create the Project (contract_pending) ---
  const template = getTemplate('app-build');
  const projectName =
    quote.organization ||
    quote.projectDescription ||
    `${contactName} project`;

  const project = await createProject(
    buildProjectInput({
      quoteId: quote.id,
      clientId: client.id,
      name: projectName,
      template,
      quotedAmount: quote.quotedAmount != null ? Number(quote.quotedAmount) : null,
    }),
  );
  if (!project?.id) throw new Error('Failed to create the project record.');

  // seed one ProjectPage per template item (frontend/backend/middleware).
  // Customer reads are carried by the customer group-read grant (TD-1); no
  // `owner` is stamped on these create inputs.
  const items: TrackedItem[] = [
    ...template.frontend,
    ...template.backend,
    ...template.middleware,
  ];
  for (const item of items) {
    await createProjectPage(buildProjectPageInput(project.id, item));
  }

  // TODO(P2): seed starter ActionItems at promotion. Map the template MIDDLEWARE
  // items that carry owner/priority/blocks into ActionItem rows (owner->owner_role,
  // priority->priority, blocks->blocks, label->title, done:false) — without
  // passing `owner` on the create input (TD-1). Deferred for FEAT-004: it changes the promotion contract
  // that P0/P1 (FEAT-002/003) intentionally left as a pure ProjectPage seed, so
  // it is NOT trivially low-risk; promoteQuote.ts stays unchanged behaviorally.

  // --- (5) mark the quote accepted ---
  await updateQuote({ id: quote.id, status: 'accepted' });

  return { projectId: project.id, clientId: client.id };
}
