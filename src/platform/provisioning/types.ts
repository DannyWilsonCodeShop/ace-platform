/**
 * Per-client account provisioning — pure state-machine types (design §3.1-§3.2).
 *
 * This module is DRY-RUN ONLY in this build. No type here imports an AWS SDK and
 * nothing here executes a real organizations:CreateAccount / MoveAccount / tag.
 * The live implementation lives in the tsconfig-excluded, NON-INVOKED seam
 * `provider.live.ts` (design §1.2) and is never reachable from this type graph.
 */

/** The ordered provisioning step ids (design §3.2). */
export type ProvisioningStepId =
  | 'preflight'
  | 'create-account'
  | 'await-account-active'
  | 'place-in-ou'
  | 'tag-account'
  | 'scaffold-amplify-app'
  | 'summary';

/** AWS account tags applied by the provisioning plan (design §3.2 step 5). */
export interface AccountTags {
  'ace:client-id': string;
  'ace:provisioned-by': string;
  'ace:env': string;
}

/**
 * A single, deterministic step of the plan. `effect` names what the live
 * provider WOULD do; nothing executes it in a dry run.
 */
export interface ProvisioningStep {
  id: ProvisioningStepId;
  /** Human-readable precondition checked before the step runs. */
  precondition: string;
  /**
   * Stable key making a re-run safe. For `create-account` this is the AWS
   * `CreateAccountRequestToken` (AWS itself dedupes by this token).
   */
  idempotencyKey: string;
  /** What WOULD happen, rendered to the admin in the dry-run plan. */
  dryRunDescription: string;
  /** The provider method this step maps to (documentation / routing only). */
  effect:
    | 'noop'
    | 'findAccountByClientTag'
    | 'createAccount'
    | 'describeCreateAccountStatus'
    | 'moveAccount'
    | 'tagAccount'
    | 'scaffoldAmplifyApp';
}

/** Config supplied at live-execution time — NEVER committed as literals (NFR6, design §3.2). */
export interface ProvisioningConfig {
  /** Org management email domain for the plus-addressed alias, e.g. 'example.com'. */
  managementEmailDomain: string;
  /** Local-part prefix of the management email, e.g. 'aws' -> aws+ace-...@domain. */
  managementEmailLocalPart: string;
  /** The Organizations OU id for the `Clients` OU. */
  clientsOuId: string;
  /** Environment tag value, e.g. 'client-app'. */
  envTag: string;
  /** Identity recorded in the `ace:provisioned-by` tag (the ACE studio account/role). */
  provisionedBy: string;
}

/** Minimal client shape the planner reads (subset of the Client model). */
export interface ProvisioningClient {
  id: string;
  organization?: string | null;
  lastName?: string | null;
}

export interface BuildProvisioningPlanInput {
  client: ProvisioningClient;
  config: ProvisioningConfig;
}

/** The computed, deterministic plan. Pure output of `buildProvisioningPlan`. */
export interface ProvisioningPlan {
  clientId: string;
  clientSlug: string;
  accountName: string;
  emailAlias: string;
  clientsOuId: string;
  tags: AccountTags;
  steps: ProvisioningStep[];
}

/** A synthetic account record returned by the provider's tag lookup. */
export interface ProvisionedAccountRef {
  accountId: string;
  accountName: string;
  tags: AccountTags;
}

export interface ProvisioningStepResult {
  id: ProvisioningStepId;
  /** `would-run` in dry-run; `skipped` when short-circuited as already provisioned. */
  status: 'would-run' | 'skipped' | 'short-circuited';
  description: string;
}

export interface ProvisioningResult {
  dryRun: true;
  clientId: string;
  /** True when preflight found an existing tagged account and the plan short-circuited. */
  alreadyProvisioned: boolean;
  /** Set when `alreadyProvisioned` is true. */
  existingAccount?: ProvisionedAccountRef;
  steps: ProvisioningStepResult[];
}

/**
 * The provider seam. The MOCK implementation (provider.ts) is the only one ever
 * imported by the state machine, UI, or tests. The LIVE implementation
 * (provider.live.ts) is tsconfig-excluded and NON-INVOKED (design §3.1, AC6).
 */
export interface ProvisioningProvider {
  /** Short-circuit lookup — returns an existing account tagged for this client, or null. */
  findAccountByClientTag(clientId: string): Promise<ProvisionedAccountRef | null>;
  createAccount(input: {
    accountName: string;
    email: string;
    createAccountRequestToken: string;
    tags: AccountTags;
  }): Promise<{ createAccountStatusId: string }>;
  describeCreateAccountStatus(statusId: string): Promise<{ accountId: string; state: 'SUCCEEDED' }>;
  moveAccount(input: { accountId: string; destinationOuId: string }): Promise<void>;
  tagAccount(input: { accountId: string; tags: AccountTags }): Promise<void>;
  scaffoldAmplifyApp(input: { accountId: string; appName: string }): Promise<{ appId: string }>;
}
