/**
 * Pure provisioning-plan builder (design §3.1-§3.2, §3.5). No I/O, no AWS import.
 *
 * `buildProvisioningPlan` computes a deterministic, re-runnable plan: ordered
 * steps, account name, plus-addressed email alias, Clients-OU target, tags, and
 * per-step idempotency keys (incl. the CreateAccountRequestToken). Real domain
 * and OU id arrive as config and are NEVER committed as literals (NFR6).
 */

import type {
  AccountTags,
  BuildProvisioningPlanInput,
  ProvisioningPlan,
  ProvisioningStep,
} from './types';

/**
 * Sanitize a client name into a slug: strip non-alphanumerics, lowercase,
 * collapse, and length-cap. Keeps a malformed name from producing an invalid
 * account name or injecting into the email alias (design §3.5).
 */
export function slugify(raw: string | null | undefined, maxLength = 24): string {
  const base = (raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const slug = base.length > 0 ? base : 'client';
  return slug.slice(0, maxLength).replace(/-+$/g, '');
}

/** Short, stable suffix derived from the client id so re-runs compute the same name. */
export function idSuffix(clientId: string, length = 6): string {
  const cleaned = clientId.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (cleaned.length >= length) return cleaned.slice(-length);
  return (cleaned + '000000').slice(0, length);
}

export function buildProvisioningPlan(input: BuildProvisioningPlanInput): ProvisioningPlan {
  const { client, config } = input;

  const clientSlug = slugify(client.organization || client.lastName);
  const suffix = idSuffix(client.id);

  // Deterministic account name (design §3.2). Uses an em dash per the spec.
  const accountName = `ACE Client — ${clientSlug}`;

  // Plus-addressed alias off the (config-supplied) management email — never hardcoded.
  const emailAlias = `${config.managementEmailLocalPart}+ace-${clientSlug}-${suffix}@${config.managementEmailDomain}`;

  const tags: AccountTags = {
    'ace:client-id': client.id,
    'ace:provisioned-by': config.provisionedBy,
    'ace:env': config.envTag,
  };

  // Idempotency key for CreateAccount — stable per client so an AWS re-run dedupes.
  const createAccountRequestToken = `ace-prov-${clientSlug}-${suffix}`;

  const steps: ProvisioningStep[] = [
    {
      id: 'preflight',
      precondition: 'Org access is readable and the client has no existing provisioned account tag.',
      idempotencyKey: `preflight-${client.id}`,
      dryRunDescription: `Would verify Organizations access and check for an existing account tagged ace:client-id=${client.id}.`,
      effect: 'findAccountByClientTag',
    },
    {
      id: 'create-account',
      precondition: 'Preflight passed and no account is tagged for this client.',
      idempotencyKey: createAccountRequestToken,
      dryRunDescription: `Would call organizations:CreateAccount name "${accountName}", email ${emailAlias}, CreateAccountRequestToken ${createAccountRequestToken}.`,
      effect: 'createAccount',
    },
    {
      id: 'await-account-active',
      precondition: 'A CreateAccountStatus id exists to poll.',
      idempotencyKey: `await-${createAccountRequestToken}`,
      dryRunDescription: 'Would poll DescribeCreateAccountStatus until SUCCEEDED and capture the new account id.',
      effect: 'describeCreateAccountStatus',
    },
    {
      id: 'place-in-ou',
      precondition: 'The new account id is known.',
      idempotencyKey: `move-${client.id}-to-${config.clientsOuId}`,
      dryRunDescription: `Would call organizations:MoveAccount from Root to the Clients OU ${config.clientsOuId} (no-op if already placed).`,
      effect: 'moveAccount',
    },
    {
      id: 'tag-account',
      precondition: 'The new account id is known.',
      idempotencyKey: `tag-${client.id}`,
      dryRunDescription: `Would tag the account ace:client-id=${client.id}, ace:provisioned-by=${config.provisionedBy}, ace:env=${config.envTag} (idempotent).`,
      effect: 'tagAccount',
    },
    {
      id: 'scaffold-amplify-app',
      precondition: 'The account is active, placed, and tagged.',
      idempotencyKey: `amplify-${client.id}`,
      dryRunDescription: `Would scaffold the per-client Amplify Gen2 app "${accountName}" in the new account (modeled on Green Casting).`,
      effect: 'scaffoldAmplifyApp',
    },
    {
      id: 'summary',
      precondition: 'Prior steps planned.',
      idempotencyKey: `summary-${client.id}`,
      dryRunDescription: 'Would produce the human-readable result and the launch-handoff next-steps pointer.',
      effect: 'noop',
    },
  ];

  return {
    clientId: client.id,
    clientSlug,
    accountName,
    emailAlias,
    clientsOuId: config.clientsOuId,
    tags,
    steps,
  };
}
