/**
 * Quote -> deal / Project lifecycle helpers (design doc §4).
 *
 * The implicit-conversion spine is split into two steps so an incoming quote
 * can become a Tab-1 client workspace without eagerly creating a Project:
 *
 *   openQuoteAsDeal(quote)       -> find-or-create the Client by contact email,
 *                                   stamp Quote.clientId, set Client.stage =
 *                                   'quote_requested'. Creates NO Project.
 *                                   Idempotent: if Quote.clientId is already
 *                                   set it just returns it.
 *
 *   createProjectForClient(c, q) -> provision the customer Cognito portal
 *                                   account, link Client.cognitoUserId, create
 *                                   the Project (status 'contract_pending')
 *                                   from the 'app-build' template and seed one
 *                                   ProjectPage per template item, then set
 *                                   Quote.status = 'accepted' and
 *                                   Client.stage = 'agreement'. Guarded by
 *                                   listProjectsByClient so it is idempotent and
 *                                   one-Project-per-Client.
 *
 * promoteQuote(quote) remains as a thin backward-compatible composition of the
 * two for any caller that still wants the full quote->Project promotion.
 *
 * OWNERSHIP (design doc §8 / Green-Casting TECH_DEBT #1): the `owner` field
 * auto-populates to the admin mutation caller — do NOT pass `owner` into any
 * CreateXInput (it is not a defined input field, and passing it is what broke
 * quote Accept with 'field not defined for input object type
 * CreateProjectInput'). Customer reads of their own project are carried by the
 * `allow.groups(['customer']).to(['read'])` grant (TD-1), not by allow.owner()
 * stamping at create.
 */

import {
  listClients,
  createClient,
  updateClient,
  createProject,
  createProjectPage,
  listProjectsByClient,
  updateQuote,
  listDemos,
  createDemo,
  getContract,
  createContract,
  listActionItems,
  createActionItem,
} from '../utils/api';
import { createPortalUser } from '../utils/createPortalUser';
import { getTemplate } from './templates';
import type { ProjectTemplate, TrackedItem } from './templates/types';
import {
  defaultChoiceBoardOptions,
  defaultContractTerms,
  defaultStarterActionItems,
} from './templates/client-package';

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

/**
 * Pure builder for the templated CHOICE_BOARD Demo seeded at promotion. Three
 * tiered options with prices pinned null (admin sets real prices in Tab 3
 * before sharing). Status is 'DRAFT' by design — the portal hides DRAFT demos
 * until the admin shares the board. MUST NOT include an `owner` key (TD-1).
 */
export function buildDemoInput(projectId: string): Record<string, any> {
  return {
    projectId,
    title: 'Concept Choice Board',
    kind: 'CHOICE_BOARD',
    status: 'DRAFT',
    options: defaultChoiceBoardOptions(),
  };
}

/**
 * Pure builder for the draft Build & Buy Contract seeded at promotion,
 * pre-filled from the agency-build-50k terms (scalar numerics as strings, see
 * client-package.ts / HIGH-1). MUST NOT include an `owner` key (TD-1).
 */
export function buildContractInput(
  projectId: string,
  clientId: string,
): Record<string, any> {
  return {
    projectId,
    clientId,
    status: 'draft',
    provider: 'manual_upload',
    amount: 50000,
    terms: defaultContractTerms(),
  };
}

/**
 * Step 1 of the spine — "Open as deal". Finds the Client by the quote's contact
 * email (case-insensitive) or creates one from the contact, stamps
 * Quote.clientId, and sets Client.stage = 'quote_requested'. Creates NO Project.
 *
 * Idempotent: if the quote already carries a clientId it returns it without
 * re-looking-up or re-creating anything.
 */
export async function openQuoteAsDeal(quote: any): Promise<{ clientId: string }> {
  if (!quote?.id) throw new Error('Cannot open as deal: quote is missing.');

  // --- idempotency: quote already linked to a client ---
  if (quote.clientId) {
    return { clientId: quote.clientId };
  }

  const email: string = (quote.email || '').trim();
  if (!email) throw new Error('Cannot open as deal: the quote has no contact email.');

  const contactName = `${quote.firstName || ''} ${quote.lastName || ''}`.trim() || email;

  // --- find or create the Client by email ---
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
      stage: 'quote_requested',
    });
    if (!client?.id) throw new Error('Failed to create the client record.');
  } else {
    // existing client — nudge the stage to quote_requested (null -> set).
    await updateClient({ id: client.id, stage: 'quote_requested' });
  }

  // --- link the Quote to the Client ---
  await updateQuote({ id: quote.id, clientId: client.id });

  return { clientId: client.id };
}

/**
 * Step 2 of the spine — turns an opened deal into a Project. Guarded on
 * listProjectsByClient(client.id): if a Project already exists for this client
 * it is reused (one-Project-per-Client, idempotent). Otherwise it provisions
 * the customer Cognito portal account, links Client.cognitoUserId, creates the
 * Project (status 'contract_pending') from the 'app-build' template, seeds one
 * ProjectPage per template item, then sets Quote.status='accepted' and
 * Client.stage='agreement'.
 *
 * No `owner` is stamped on any create input (TD-1).
 */
export async function createProjectForClient(
  client: any,
  quote: any,
): Promise<{ projectId: string; clientId: string }> {
  if (!client?.id) throw new Error('Cannot create project: client is missing.');
  if (!quote?.id) throw new Error('Cannot create project: quote is missing.');

  // --- guard: reuse an existing Project for this client ---
  try {
    const existing = await listProjectsByClient(client.id);
    if (existing && existing.length > 0) {
      return { projectId: existing[0].id, clientId: client.id };
    }
  } catch (err: any) {
    throw new Error(`Could not look up existing projects: ${err.message || err}`);
  }

  const email: string = (quote.email || client.email || '').trim();
  const contactName =
    `${quote.firstName || client.firstName || ''} ${quote.lastName || client.lastName || ''}`.trim() ||
    email;

  // --- provision the customer Cognito portal account ---
  const portal = await createPortalUser({
    action: 'createCustomer',
    email,
    name: contactName,
    phone: quote.phone || client.phone || undefined,
  });
  if (!portal.success) {
    throw new Error(`Failed to provision the portal account: ${portal.message}`);
  }

  // The create-user Lambda returns the Cognito Username (email-based) as
  // userId. This links the Client to the portal account; it is NOT stamped as
  // `owner` on any create input (TD-1).
  const cognitoUserId = portal.userId || email;

  // --- link the Client to the portal account + bump totalProjects ---
  await updateClient({
    id: client.id,
    cognitoUserId,
    totalProjects: (client.totalProjects || 0) + 1,
  });

  // --- create the Project (contract_pending) ---
  const template = getTemplate('app-build');
  const projectName =
    quote.organization ||
    client.organization ||
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

  // --- seed the templated client package (design §2.3) ---------------------
  // Idempotent, mirroring the listProjectsByClient guard above. Error rule
  // (MEDIUM-4): a LOOKUP throw is FATAL and rethrown (never swallowed into [],
  // which would defeat the guard and double-seed); a single CREATE throw is
  // RECOVERABLE — caught, warned, and left for an idempotent re-run so a failed
  // seed never aborts the whole promotion (the Project + portal access exist).
  await seedClientPackage(project.id, client.id);

  // --- advance the lifecycle: quote accepted, client at the agreement stage ---
  await updateQuote({ id: quote.id, status: 'accepted' });
  await updateClient({ id: client.id, stage: 'agreement' });

  return { projectId: project.id, clientId: client.id };
}

/**
 * Idempotently seed the templated client package (CHOICE_BOARD Demo + draft
 * Build & Buy Contract + three starter ActionItems) for a just-created Project.
 * Design §2.3.
 *
 * Error rule (MEDIUM-4): a LOOKUP throw is FATAL — it is rethrown with a
 * descriptive message and no create is attempted (never swallow a lookup error
 * into `[]`, which would make the `.length === 0` guard pass falsely and
 * double-seed). A single CREATE throw is RECOVERABLE — isolated to that one
 * entity and left for an idempotent re-run; it must not abort the promotion.
 */
async function seedClientPackage(projectId: string, clientId: string): Promise<void> {
  // --- Demo (lookup = fatal gate) ---
  let demos: any[];
  try {
    demos = await listDemos(projectId);
  } catch (err: any) {
    throw new Error(`Could not look up existing demos to seed: ${err.message || err}`);
  }
  if (demos.length === 0) {
    try {
      await createDemo(buildDemoInput(projectId));
    } catch (err: any) {
      console.warn('Seeding the templated Demo failed (re-run to retry):', err?.message || err);
    }
  }

  // --- Contract (lookup = fatal gate) ---
  let contracts: any[];
  try {
    contracts = await getContract(projectId);
  } catch (err: any) {
    throw new Error(`Could not look up existing contract to seed: ${err.message || err}`);
  }
  if (contracts.length === 0) {
    try {
      await createContract(buildContractInput(projectId, clientId));
    } catch (err: any) {
      console.warn('Seeding the draft Contract failed (re-run to retry):', err?.message || err);
    }
  }

  // --- ActionItems (lookup = fatal gate) ---
  let items: any[];
  try {
    items = await listActionItems(projectId);
  } catch (err: any) {
    throw new Error(`Could not look up existing action items to seed: ${err.message || err}`);
  }
  if (items.length === 0) {
    for (const ai of defaultStarterActionItems(projectId)) {
      try {
        await createActionItem(ai);
      } catch (err: any) {
        console.warn(
          `Seeding starter action item "${ai.title}" failed (re-run to retry):`,
          err?.message || err,
        );
      }
    }
  }
}

/**
 * Backward-compatible full promotion: open the deal (find/create client + link
 * quote), then create the Project. Composes openQuoteAsDeal +
 * createProjectForClient so existing callers that still want a Project in one
 * step keep working. The double-promotion guard is carried by
 * createProjectForClient's listProjectsByClient idempotency.
 */
export async function promoteQuote(quote: any): Promise<PromoteResult> {
  if (!quote?.id) throw new Error('Cannot promote: quote is missing.');

  const { clientId } = await openQuoteAsDeal(quote);

  // Resolve the full client record for the project-creation step.
  let client: any = null;
  try {
    const clients = await listClients();
    client = (clients || []).find((c: any) => c.id === clientId);
  } catch (err: any) {
    throw new Error(`Could not look up the client record: ${err.message || err}`);
  }
  if (!client) {
    // Fall back to a minimal shape; createProjectForClient only needs id + a
    // few optional contact fields, pulling the rest from the quote.
    client = { id: clientId };
  }

  return createProjectForClient(client, quote);
}
