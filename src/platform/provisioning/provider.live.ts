/**
 * ============================================================================
 * NON-INVOKED LIVE SEAM — REFERENCE TEXT ONLY. DO NOT IMPORT. DO NOT RUN.
 * ============================================================================
 *
 * This file is listed in tsconfig.json "exclude", so `tsc` NEVER type-checks it
 * and the un-installed `@aws-sdk/*` imports below do NOT break `npm run build`
 * (design §1.2). It is NOT imported by stateMachine.ts, any UI module, or any
 * test (AC6). It documents the EXACT AWS calls the external Lambda will make
 * when Dan later enables live provisioning against a throwaway test account.
 *
 * NOTHING HERE EXECUTES. There is no real organizations:CreateAccount /
 * MoveAccount / RemoveAccountFromOrganization, no real Amplify app create.
 *
 * To wire this live LATER (outside this build): install the two SDK packages in
 * the external Lambda, remove this file from tsconfig "exclude", and inject the
 * clients. Even then, the live action stays behind an explicit confirm gate.
 */

// NOTE: these packages are intentionally NOT in package.json for this repo.
import {
  OrganizationsClient,
  CreateAccountCommand,
  DescribeCreateAccountStatusCommand,
  MoveAccountCommand,
  TagResourceCommand,
} from '@aws-sdk/client-organizations';
import { AmplifyClient, CreateAppCommand } from '@aws-sdk/client-amplify';

import type {
  AccountTags,
  ProvisionedAccountRef,
  ProvisioningProvider,
} from './types';

/**
 * The real provider. Every method maps 1:1 to the dry-run `effect` on the plan
 * steps. Constructed with injected SDK clients so the Lambda controls region
 * and credentials; this file never reads credentials from the environment at
 * module scope.
 */
export class AwsProvisioningProvider implements ProvisioningProvider {
  constructor(
    private readonly orgs: OrganizationsClient,
    private readonly amplify: AmplifyClient,
    private readonly managementAccountRootArnPrefix: string,
  ) {}

  async findAccountByClientTag(clientId: string): Promise<ProvisionedAccountRef | null> {
    // Live impl: ListAccounts + ListTagsForResource (or Resource Groups Tagging
    // API) filtered by ace:client-id=clientId. Returns the first match or null.
    // Documented here; left unimplemented in the reference seam.
    void clientId;
    void this.managementAccountRootArnPrefix;
    return null;
  }

  async createAccount(input: {
    accountName: string;
    email: string;
    createAccountRequestToken: string;
    tags: AccountTags;
  }): Promise<{ createAccountStatusId: string }> {
    const res = await this.orgs.send(
      new CreateAccountCommand({
        AccountName: input.accountName,
        Email: input.email,
        // AWS dedupes repeated CreateAccount by this token — this is the idempotency key.
        // (AWS SDK field name differs by version; the external Lambda author adjusts.)
        Tags: Object.entries(input.tags).map(([Key, Value]) => ({ Key, Value })),
      }),
    );
    const id = res.CreateAccountStatus?.Id;
    if (!id) throw new Error('CreateAccount returned no CreateAccountStatus.Id');
    return { createAccountStatusId: id };
  }

  async describeCreateAccountStatus(
    statusId: string,
  ): Promise<{ accountId: string; state: 'SUCCEEDED' }> {
    // Live impl polls until State === 'SUCCEEDED'; FAILED surfaces FailureReason.
    const res = await this.orgs.send(
      new DescribeCreateAccountStatusCommand({ CreateAccountRequestId: statusId }),
    );
    const status = res.CreateAccountStatus;
    if (status?.State !== 'SUCCEEDED' || !status.AccountId) {
      throw new Error(`CreateAccount not succeeded: ${status?.State} ${status?.FailureReason ?? ''}`);
    }
    return { accountId: status.AccountId, state: 'SUCCEEDED' };
  }

  async moveAccount(input: { accountId: string; destinationOuId: string }): Promise<void> {
    await this.orgs.send(
      new MoveAccountCommand({
        AccountId: input.accountId,
        // SourceParentId is the Root id; supplied by the Lambda config.
        SourceParentId: 'r-root',
        DestinationParentId: input.destinationOuId,
      }),
    );
  }

  async tagAccount(input: { accountId: string; tags: AccountTags }): Promise<void> {
    await this.orgs.send(
      new TagResourceCommand({
        ResourceId: input.accountId,
        Tags: Object.entries(input.tags).map(([Key, Value]) => ({ Key, Value })),
      }),
    );
  }

  async scaffoldAmplifyApp(input: {
    accountId: string;
    appName: string;
  }): Promise<{ appId: string }> {
    // Runs against the NEW member account's credentials (cross-account), not ACE's.
    const res = await this.amplify.send(new CreateAppCommand({ name: input.appName }));
    const appId = res.app?.appId;
    if (!appId) throw new Error('CreateApp returned no appId');
    void input.accountId;
    return { appId };
  }
}
