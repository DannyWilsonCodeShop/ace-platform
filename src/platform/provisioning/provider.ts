/**
 * Provisioning provider seam (design §3.1). The MockProvisioningProvider is the
 * ONLY provider imported by the state machine, UI, or tests in this build. The
 * live AWS implementation lives in the tsconfig-excluded, NON-INVOKED
 * `provider.live.ts` and never enters this import graph (AC6).
 *
 * The mock records every call and returns synthetic ids, so a test can assert
 * ZERO live invocations and inspect exactly what WOULD have been requested.
 */

import type {
  AccountTags,
  ProvisionedAccountRef,
  ProvisioningProvider,
} from './types';

export interface RecordedCall {
  method: keyof ProvisioningProvider;
  args: unknown;
}

export interface MockProvisioningProviderOptions {
  /**
   * When set, `findAccountByClientTag` returns this account for a matching
   * clientId, driving the "already provisioned" short-circuit.
   */
  existingAccount?: ProvisionedAccountRef | null;
}

/**
 * Records calls and returns deterministic synthetic ids. Executes NO real AWS
 * call. In a dry run the state machine does not invoke the mutating methods at
 * all, so `calls` should contain only the lookup for a fresh client.
 */
export class MockProvisioningProvider implements ProvisioningProvider {
  readonly calls: RecordedCall[] = [];
  private readonly existingAccount: ProvisionedAccountRef | null;

  constructor(options: MockProvisioningProviderOptions = {}) {
    this.existingAccount = options.existingAccount ?? null;
  }

  private record(method: keyof ProvisioningProvider, args: unknown): void {
    this.calls.push({ method, args });
  }

  /** Count of calls that would mutate AWS (everything except the read-only lookup). */
  get liveMutationCount(): number {
    return this.calls.filter((c) => c.method !== 'findAccountByClientTag').length;
  }

  async findAccountByClientTag(clientId: string): Promise<ProvisionedAccountRef | null> {
    this.record('findAccountByClientTag', { clientId });
    if (this.existingAccount && this.existingAccount.tags['ace:client-id'] === clientId) {
      return this.existingAccount;
    }
    return null;
  }

  async createAccount(input: {
    accountName: string;
    email: string;
    createAccountRequestToken: string;
    tags: AccountTags;
  }): Promise<{ createAccountStatusId: string }> {
    this.record('createAccount', input);
    return { createAccountStatusId: `car-${input.createAccountRequestToken}` };
  }

  async describeCreateAccountStatus(
    statusId: string,
  ): Promise<{ accountId: string; state: 'SUCCEEDED' }> {
    this.record('describeCreateAccountStatus', { statusId });
    return { accountId: `acct-${statusId}`, state: 'SUCCEEDED' };
  }

  async moveAccount(input: { accountId: string; destinationOuId: string }): Promise<void> {
    this.record('moveAccount', input);
  }

  async tagAccount(input: { accountId: string; tags: AccountTags }): Promise<void> {
    this.record('tagAccount', input);
  }

  async scaffoldAmplifyApp(input: {
    accountId: string;
    appName: string;
  }): Promise<{ appId: string }> {
    this.record('scaffoldAmplifyApp', input);
    return { appId: `app-${input.accountId}` };
  }
}
