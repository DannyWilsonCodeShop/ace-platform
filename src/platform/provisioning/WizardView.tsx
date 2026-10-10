/**
 * Provisioning wizard view (design §3.3) — OPTIONAL, SAFE, dry-run only.
 *
 * Renders the dry-run plan from buildProvisioningPlan + runProvisioning(...,
 * { dryRun: true }) using the MOCK provider only, with a prominent
 * irreversibility banner. The "Run live provisioning" action is DISABLED and
 * wired to nothing executable — the live provider (provider.live.ts) is
 * tsconfig-excluded and never imported, so it cannot run and no @aws-sdk/* is
 * pulled into the bundle. No real organizations:CreateAccount is reachable.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { buildProvisioningPlan } from './plan';
import { runProvisioning } from './stateMachine';
import { MockProvisioningProvider } from './provider';
import type {
  ProvisioningClient,
  ProvisioningConfig,
  ProvisioningResult,
} from './types';

/**
 * Non-secret display config for the dry-run. The real management email domain
 * and Clients-OU id are supplied at live-enable time and are NEVER committed;
 * these placeholders only make the dry-run plan readable (design §3.2, NFR6).
 */
const DRY_RUN_DISPLAY_CONFIG: ProvisioningConfig = {
  managementEmailDomain: 'example.com',
  managementEmailLocalPart: 'aws',
  clientsOuId: 'ou-REPLACE-at-live-enable',
  envTag: 'client-app',
  provisionedBy: 'ace-studio',
};

export interface WizardViewProps {
  client: ProvisioningClient;
  /** Optional override for the display-only dry-run config. */
  config?: ProvisioningConfig;
}

export default function WizardView({ client, config }: WizardViewProps) {
  const effectiveConfig = config ?? DRY_RUN_DISPLAY_CONFIG;
  const plan = buildProvisioningPlan({ client, config: effectiveConfig });
  const [result, setResult] = useState<ProvisioningResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Dry-run only, mock provider only — records zero live mutations.
    runProvisioning(plan, new MockProvisioningProvider(), { dryRun: true }).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.id]);

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Provision client account</h1>
        <p className="text-ace-muted text-sm">
          Dry-run plan for <span className="font-semibold">{plan.accountName}</span>. Nothing below
          executes.
        </p>
      </div>

      {/* Irreversibility banner (design §3.3). */}
      <div className="card mb-4 border border-red-500/30 bg-red-500/5">
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-200">
            Creating an AWS account is largely irreversible — there is no hard delete for 90 days.
            This screen shows a dry-run only; it creates nothing.
          </p>
        </div>
      </div>

      {/* Computed plan summary. */}
      <div className="card mb-4">
        <h2 className="text-lg font-semibold mb-3">Planned account</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-ace-muted">Account name</dt>
          <dd className="font-mono">{plan.accountName}</dd>
          <dt className="text-ace-muted">Email alias</dt>
          <dd className="font-mono break-all">{plan.emailAlias}</dd>
          <dt className="text-ace-muted">Clients OU</dt>
          <dd className="font-mono">{plan.clientsOuId}</dd>
          <dt className="text-ace-muted">Tags</dt>
          <dd className="font-mono break-all">
            {Object.entries(plan.tags)
              .map(([k, v]) => `${k}=${v}`)
              .join('  ')}
          </dd>
        </dl>
      </div>

      {/* The ordered dry-run steps. */}
      <div className="card mb-4">
        <h2 className="text-lg font-semibold mb-3">Dry-run steps (what WOULD happen)</h2>
        {!result ? (
          <p className="text-sm text-ace-muted">Computing dry-run…</p>
        ) : (
          <ol className="space-y-2">
            {result.steps.map((step, i) => (
              <li
                key={step.id}
                className="flex items-start gap-2 bg-[#0e0e0e] rounded-lg p-3 border border-[rgba(255,255,255,0.04)]"
              >
                <span className="text-ace-muted text-xs font-mono mt-0.5">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium font-mono">{step.id}</span>
                    <span className="badge bg-white/5 text-ace-muted">{step.status}</span>
                  </div>
                  <p className="text-xs text-ace-muted leading-snug mt-1">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Disabled live action — wired to nothing executable (design §3.3). */}
      <div className="card border border-white/10">
        <div className="flex items-start gap-2 mb-3">
          <ShieldAlert size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-ace-muted">
            Live provisioning is disabled in this build. The live provider is not bundled, so this
            action cannot execute. Dan enables it deliberately later, against a throwaway test
            account, after reviewing a dry-run.
          </p>
        </div>
        <button
          type="button"
          disabled
          title="Live provisioning is disabled in this build"
          className="btn-primary text-sm opacity-40 cursor-not-allowed"
        >
          Run live provisioning (test account)
        </button>
      </div>
    </div>
  );
}
