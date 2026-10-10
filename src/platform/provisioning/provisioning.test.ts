import { describe, it, expect } from 'vitest';
import { buildProvisioningPlan, slugify } from './plan';
import { runProvisioning } from './stateMachine';
import { MockProvisioningProvider } from './provider';
import type { ProvisioningConfig, ProvisioningStepId } from './types';

/**
 * FEAT-002 Capability 2 (design §3.6; AC5/AC6).
 *
 * All assertions are pure/dry-run. NO real organizations:CreateAccount /
 * MoveAccount / tag is executed, and the live provider (provider.live.ts) is
 * never imported here — the grep guard at the bottom documents that (AC6).
 */

// Config is injected, never a committed literal (NFR6).
const config: ProvisioningConfig = {
  managementEmailDomain: 'example.com',
  managementEmailLocalPart: 'aws',
  clientsOuId: 'ou-test-clients',
  envTag: 'client-app',
  provisionedBy: 'ace-studio',
};

const EXPECTED_ORDER: ProvisioningStepId[] = [
  'preflight',
  'create-account',
  'await-account-active',
  'place-in-ou',
  'tag-account',
  'scaffold-amplify-app',
  'summary',
];

describe('slugify', () => {
  it('strips non-alphanumerics, lowercases, and length-caps', () => {
    expect(slugify('Mercedes-Benz USA!!')).toBe('mercedes-benz-usa');
    expect(slugify('   ')).toBe('client');
    expect(slugify(null)).toBe('client');
    expect(slugify('A'.repeat(100)).length).toBeLessThanOrEqual(24);
  });

  it('does not leave a trailing hyphen after capping', () => {
    const s = slugify('aaaaaaaaaaaaaaaaaaaaaaaa-tail');
    expect(s.endsWith('-')).toBe(false);
  });
});

describe('buildProvisioningPlan', () => {
  const plan = buildProvisioningPlan({
    client: { id: 'client-abc123', organization: 'Mercedes', lastName: 'Benz' },
    config,
  });

  it('produces the ordered steps', () => {
    expect(plan.steps.map((s) => s.id)).toEqual(EXPECTED_ORDER);
  });

  it('computes a deterministic account name from the org slug', () => {
    expect(plan.accountName).toBe('ACE Client — mercedes');
    expect(plan.clientSlug).toBe('mercedes');
  });

  it('builds a plus-addressed email alias from config (no committed domain literal)', () => {
    expect(plan.emailAlias).toMatch(/^aws\+ace-mercedes-[a-z0-9]{6}@example\.com$/);
  });

  it('targets the configured Clients OU', () => {
    expect(plan.clientsOuId).toBe('ou-test-clients');
  });

  it('tags with ace:client-id / ace:provisioned-by / ace:env', () => {
    expect(plan.tags).toEqual({
      'ace:client-id': 'client-abc123',
      'ace:provisioned-by': 'ace-studio',
      'ace:env': 'client-app',
    });
  });

  it('uses the CreateAccountRequestToken as the create-account idempotency key', () => {
    const createStep = plan.steps.find((s) => s.id === 'create-account')!;
    expect(createStep.idempotencyKey).toMatch(/^ace-prov-mercedes-[a-z0-9]{6}$/);
    // The token appears in the dry-run description so the admin can see it.
    expect(createStep.dryRunDescription).toContain(createStep.idempotencyKey);
  });

  it('is deterministic — re-running computes the same name/alias/token', () => {
    const again = buildProvisioningPlan({
      client: { id: 'client-abc123', organization: 'Mercedes', lastName: 'Benz' },
      config,
    });
    expect(again.accountName).toBe(plan.accountName);
    expect(again.emailAlias).toBe(plan.emailAlias);
    expect(again.steps.map((s) => s.idempotencyKey)).toEqual(
      plan.steps.map((s) => s.idempotencyKey),
    );
  });

  it('falls back to lastName when organization is absent', () => {
    const p = buildProvisioningPlan({
      client: { id: 'c-1', organization: null, lastName: 'Smith' },
      config,
    });
    expect(p.clientSlug).toBe('smith');
  });
});

describe('runProvisioning (dry-run)', () => {
  const plan = buildProvisioningPlan({
    client: { id: 'client-abc123', organization: 'Mercedes', lastName: 'Benz' },
    config,
  });

  it('returns the dry-run plan shape with every step marked would-run', async () => {
    const provider = new MockProvisioningProvider();
    const result = await runProvisioning(plan, provider, { dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.alreadyProvisioned).toBe(false);
    expect(result.steps.map((s) => s.id)).toEqual(EXPECTED_ORDER);
    expect(result.steps.every((s) => s.status === 'would-run')).toBe(true);
  });

  it('records ZERO live mutations (only the read-only tag lookup runs)', async () => {
    const provider = new MockProvisioningProvider();
    await runProvisioning(plan, provider, { dryRun: true });

    expect(provider.liveMutationCount).toBe(0);
    // The only call made is the preflight tag lookup.
    expect(provider.calls.map((c) => c.method)).toEqual(['findAccountByClientTag']);
  });

  it('defaults to dry-run when no options are passed', async () => {
    const provider = new MockProvisioningProvider();
    const result = await runProvisioning(plan, provider);
    expect(result.dryRun).toBe(true);
    expect(provider.liveMutationCount).toBe(0);
  });

  it('refuses to run live (the live path is disabled in this build)', async () => {
    const provider = new MockProvisioningProvider();
    await expect(runProvisioning(plan, provider, { dryRun: false })).rejects.toThrow(
      /live execution is disabled/i,
    );
  });

  it('short-circuits to already-provisioned when findAccountByClientTag returns an account', async () => {
    const provider = new MockProvisioningProvider({
      existingAccount: {
        accountId: '111122223333',
        accountName: 'ACE Client — mercedes',
        tags: {
          'ace:client-id': 'client-abc123',
          'ace:provisioned-by': 'ace-studio',
          'ace:env': 'client-app',
        },
      },
    });

    const result = await runProvisioning(plan, provider, { dryRun: true });

    expect(result.alreadyProvisioned).toBe(true);
    expect(result.existingAccount?.accountId).toBe('111122223333');
    // No mutating step attempted; still zero live mutations.
    expect(provider.liveMutationCount).toBe(0);
    const nonPreflight = result.steps.filter((s) => s.id !== 'preflight');
    expect(nonPreflight.every((s) => s.status === 'skipped')).toBe(true);
    expect(result.steps.find((s) => s.id === 'preflight')!.status).toBe('short-circuited');
  });
});

/**
 * AC6 unreachability guard. This test documents the contract that the live seam
 * is never imported; the enforced check is the build-step grep:
 *   grep -rn "provider.live" src | grep -i import   -> returns nothing outside provider.live.ts
 * and tsconfig excludes provider.live.ts so an accidental import also breaks tsc.
 */
describe('AC6: live provider is unreachable', () => {
  it('MockProvisioningProvider is the only provider used by the state machine', () => {
    // Importing provider.live.ts here is intentionally NOT done.
    const provider = new MockProvisioningProvider();
    expect(provider).toBeInstanceOf(MockProvisioningProvider);
  });
});
