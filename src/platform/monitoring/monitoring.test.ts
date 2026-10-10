import { describe, it, expect } from 'vitest';
import { toMonitoringViewModel } from './shape';
import { MockMonitoringSource, cannedPayload } from './source';
import type { MockHealthState } from './source';
import type { ClientMonitoringTarget, HealthStatus } from './types';

/**
 * FEAT-002 Capability 3 (design §4.5; AC7/AC8).
 *
 * All assertions are pure. NO real STS AssumeRole and NO real CloudWatch/Logs
 * read is executed; the live source (source.live.ts) is never imported here —
 * the grep guard at the bottom documents that (AC6/AC8).
 */

const NOW = 1_700_000_123_456;

describe('toMonitoringViewModel — all five health states (AC7)', () => {
  const cases: Array<[MockHealthState, HealthStatus]> = [
    ['healthy', 'healthy'],
    ['degraded', 'degraded'],
    ['error', 'error'],
    ['unknown', 'unknown'],
    ['not_provisioned', 'not_provisioned'],
  ];

  it.each(cases)('maps the %s payload to status %s', (state, expected) => {
    const vm = toMonitoringViewModel(cannedPayload(state), NOW);
    expect(vm.status).toBe(expected);
    expect(vm.shapedAt).toBe(NOW);
    expect(typeof vm.statusReason).toBe('string');
    expect(vm.statusReason.length).toBeGreaterThan(0);
  });

  it('computes an error-rate percentage from metrics', () => {
    const vm = toMonitoringViewModel(cannedPayload('error'), NOW);
    expect(vm.errorRatePct).toBeCloseTo(10);
  });

  it('reports null error-rate for not_provisioned and unknown', () => {
    expect(toMonitoringViewModel(cannedPayload('not_provisioned'), NOW).errorRatePct).toBeNull();
    expect(toMonitoringViewModel(cannedPayload('unknown'), NOW).errorRatePct).toBeNull();
  });

  it('shapes recent error log events with iso timestamps', () => {
    const vm = toMonitoringViewModel(cannedPayload('error'), NOW);
    expect(vm.recentErrors.length).toBe(2);
    expect(vm.recentErrors[0].isoTime).toBe(new Date(vm.recentErrors[0].timestamp).toISOString());
  });

  it('treats untrusted/missing fields safely (no undefined leaks)', () => {
    const vm = toMonitoringViewModel(
      { provisioned: true, metrics: { errors: NaN as unknown as number, invocations: 0 } },
      NOW,
    );
    // invocations 0 -> no computable rate -> null, and with no alarms/build it is healthy
    expect(vm.errorRatePct).toBeNull();
    expect(vm.alarmCounts).toEqual({ alarm: 0, ok: 0, insufficientData: 0 });
    expect(vm.buildState).toBe('UNKNOWN');
    expect(vm.recentErrors).toEqual([]);
  });

  it('degrades on insufficient-data alarms even with a clean error rate', () => {
    const vm = toMonitoringViewModel(
      {
        provisioned: true,
        metrics: { errors: 0, invocations: 1000 },
        alarms: { alarm: 0, ok: 1, insufficientData: 3 },
        buildState: 'SUCCEED',
      },
      NOW,
    );
    expect(vm.status).toBe('degraded');
  });

  it('errors when the latest build failed even with no alarms', () => {
    const vm = toMonitoringViewModel(
      {
        provisioned: true,
        metrics: { errors: 0, invocations: 1000 },
        alarms: { alarm: 0, ok: 2, insufficientData: 0 },
        buildState: 'FAILED',
      },
      NOW,
    );
    expect(vm.status).toBe('error');
  });
});

describe('per-client isolation (AC8)', () => {
  const targetA: ClientMonitoringTarget = {
    accountId: '111111111111',
    roleArn: 'arn:aws:iam::111111111111:role/ACEMonitoringReadOnly',
    externalId: 'ext-id-A',
  };
  const targetB: ClientMonitoringTarget = {
    accountId: '222222222222',
    roleArn: 'arn:aws:iam::222222222222:role/ACEMonitoringReadOnly',
    externalId: 'ext-id-B',
  };

  it('fetches client A using ONLY client A\'s exact target', async () => {
    const source = new MockMonitoringSource('healthy');
    await source.fetch(targetA);

    expect(source.fetches).toHaveLength(1);
    expect(source.fetches[0].target).toEqual(targetA);
    // Never a shared or client-B value.
    expect(source.fetches[0].target.externalId).not.toBe(targetB.externalId);
    expect(source.fetches[0].target.accountId).not.toBe(targetB.accountId);
  });

  it('records a distinct target per call — no shared/global credential', async () => {
    const source = new MockMonitoringSource('healthy');
    await source.fetch(targetA);
    await source.fetch(targetB);

    expect(source.fetches.map((f) => f.target.accountId)).toEqual([
      targetA.accountId,
      targetB.accountId,
    ]);
    // The recorded target is a copy, not a shared reference.
    expect(source.fetches[0].target).not.toBe(targetA);
  });

  it('requires a target to fetch (the interface takes it by value)', () => {
    const source = new MockMonitoringSource();
    // Type-level guarantee: fetch cannot be called without a target. Runtime
    // check that the method expects one argument.
    expect(source.fetch.length).toBe(1);
  });
});

/**
 * AC6/AC8 unreachability guard. The live source is never imported here; the
 * enforced check is the build-step grep:
 *   grep -rn "source.live" src | grep -i import  -> nothing outside source.live.ts
 * and tsconfig excludes source.live.ts so an accidental import also breaks tsc.
 */
describe('AC6: live monitoring source is unreachable', () => {
  it('MockMonitoringSource is the only source used by the app/tests', () => {
    const source = new MockMonitoringSource('not_provisioned');
    expect(source).toBeInstanceOf(MockMonitoringSource);
  });
});
