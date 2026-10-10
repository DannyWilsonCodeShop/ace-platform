/**
 * Pure, dry-run provisioning state machine (design §3.2-§3.3).
 *
 * `runProvisioning(plan, provider, { dryRun: true })` iterates the plan's steps
 * and returns a ProvisioningResult log of what WOULD happen. dryRun:true is the
 * default AND the only supported in-build mode — this module throws if asked to
 * run live, because the only live code path (provider.live.ts) is tsconfig-
 * excluded and NON-INVOKED (AC6). No live provider is imported here.
 *
 * The preflight step calls `findAccountByClientTag`; if an account already
 * carries this client's tag, the plan short-circuits to "already provisioned"
 * and no mutating step is attempted.
 */

import type {
  ProvisioningPlan,
  ProvisioningProvider,
  ProvisioningResult,
  ProvisioningStepResult,
} from './types';

export interface RunProvisioningOptions {
  /** Only dry-run is supported in this build; defaults to true. */
  dryRun?: boolean;
}

export async function runProvisioning(
  plan: ProvisioningPlan,
  provider: ProvisioningProvider,
  options: RunProvisioningOptions = {},
): Promise<ProvisioningResult> {
  const dryRun = options.dryRun ?? true;
  if (!dryRun) {
    // The live path is intentionally unreachable in this build (design §3.3).
    throw new Error(
      'runProvisioning: live execution is disabled in this build. Only dryRun:true is supported.',
    );
  }

  // Preflight: short-circuit if the client already has a tagged account.
  const existingAccount = await provider.findAccountByClientTag(plan.clientId);
  if (existingAccount) {
    const steps: ProvisioningStepResult[] = plan.steps.map((step) => ({
      id: step.id,
      status: step.id === 'preflight' ? 'short-circuited' : 'skipped',
      description:
        step.id === 'preflight'
          ? `Already provisioned: found account ${existingAccount.accountId} tagged ace:client-id=${plan.clientId}.`
          : 'Skipped — account already provisioned.',
    }));
    return {
      dryRun: true,
      clientId: plan.clientId,
      alreadyProvisioned: true,
      existingAccount,
      steps,
    };
  }

  // Fresh client: record what each step WOULD do without invoking any mutation.
  const steps: ProvisioningStepResult[] = plan.steps.map((step) => ({
    id: step.id,
    status: 'would-run',
    description: step.dryRunDescription,
  }));

  return {
    dryRun: true,
    clientId: plan.clientId,
    alreadyProvisioned: false,
    steps,
  };
}
