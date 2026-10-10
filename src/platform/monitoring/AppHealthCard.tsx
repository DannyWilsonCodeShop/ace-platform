/**
 * "App health" card (design §4.3) — OPTIONAL, SAFE, mock-fed.
 *
 * Reads a MockMonitoringSource and shapes the payload with the pure
 * toMonitoringViewModel. Every real client today is `not_provisioned` (no
 * account/role yet), so that is the default. Binds STRICTLY to the mock source
 * — the live source (source.live.ts) is tsconfig-excluded and never imported,
 * so no @aws-sdk/* dependency enters the browser bundle. No STS/CloudWatch read
 * is reachable.
 */

import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import { toMonitoringViewModel } from './shape';
import { MockMonitoringSource } from './source';
import type { MockHealthState } from './source';
import type { HealthStatus, MonitoringViewModel } from './types';

export interface AppHealthCardProps {
  /**
   * Which mock state to render. Defaults to `not_provisioned`, which is the
   * truthful state for every real client in this build.
   */
  mockState?: MockHealthState;
}

const STATUS_STYLE: Record<HealthStatus, { label: string; cls: string }> = {
  healthy: { label: 'Healthy', cls: 'bg-green-500/15 text-green-400' },
  degraded: { label: 'Degraded', cls: 'bg-yellow-500/15 text-yellow-400' },
  error: { label: 'Error', cls: 'bg-red-500/15 text-red-400' },
  unknown: { label: 'Unavailable', cls: 'bg-white/5 text-ace-muted' },
  not_provisioned: { label: 'Not provisioned', cls: 'bg-white/5 text-ace-muted' },
};

export default function AppHealthCard({ mockState = 'not_provisioned' }: AppHealthCardProps) {
  const [vm, setVm] = useState<MonitoringViewModel | null>(null);

  useEffect(() => {
    let cancelled = false;
    const source = new MockMonitoringSource(mockState);
    // The target is required by value — per-client isolation is structural.
    // Non-secret placeholder values; no real role/account is read in this build.
    source
      .fetch({
        accountId: '000000000000',
        roleArn: 'arn:aws:iam::000000000000:role/ACEMonitoringReadOnly',
        externalId: 'mock-external-id',
      })
      .then((raw) => {
        if (!cancelled) setVm(toMonitoringViewModel(raw, Date.now()));
      });
    return () => {
      cancelled = true;
    };
  }, [mockState]);

  const style = vm ? STATUS_STYLE[vm.status] : null;

  return (
    <div className="card">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <Activity size={16} className="text-ace-cyan" /> App health
      </h3>

      {!vm ? (
        <p className="text-sm text-ace-muted">Loading…</p>
      ) : vm.status === 'not_provisioned' ? (
        <p className="text-sm text-ace-muted">App not yet provisioned.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={'badge ' + style!.cls}>{style!.label}</span>
            {vm.errorRatePct !== null && (
              <span className="text-xs text-ace-muted">
                error rate {vm.errorRatePct.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-xs text-ace-muted">{vm.statusReason}</p>
          <div className="text-xs text-ace-muted">
            Alarms: {vm.alarmCounts.alarm} alarm · {vm.alarmCounts.ok} ok ·{' '}
            {vm.alarmCounts.insufficientData} insufficient · build {vm.buildState}
          </div>
          {vm.recentErrors.length > 0 && (
            <details>
              <summary className="text-xs text-ace-muted cursor-pointer">
                Recent errors ({vm.recentErrors.length})
              </summary>
              <ul className="mt-2 space-y-1">
                {vm.recentErrors.map((e, i) => (
                  <li key={i} className="text-xs font-mono text-ace-muted break-all">
                    {e.isoTime} — {e.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
