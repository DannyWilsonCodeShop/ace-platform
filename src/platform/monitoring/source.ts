/**
 * Mock monitoring source (design §4.2, §4.5). The ONLY MonitoringSource used by
 * the app or tests in this build. Returns canned payloads for each of the five
 * health states and RECORDS the exact ClientMonitoringTarget it was asked for,
 * so a test can assert per-client isolation — client A is read only with client
 * A's exact {accountId, roleArn, externalId}, never a shared or client-B value
 * (AC8). The live source (source.live.ts) is tsconfig-excluded and NON-INVOKED.
 */

import type {
  ClientMonitoringTarget,
  MonitoringSource,
  RawMonitoringPayload,
} from './types';

/** The health state a MockMonitoringSource should emit. */
export type MockHealthState =
  | 'healthy'
  | 'degraded'
  | 'error'
  | 'unknown'
  | 'not_provisioned';

/** Canned payloads, one per health state (design §4.3 conditions). */
export function cannedPayload(state: MockHealthState): RawMonitoringPayload {
  switch (state) {
    case 'healthy':
      return {
        provisioned: true,
        metrics: { errors: 0, invocations: 1000 },
        alarms: { alarm: 0, ok: 4, insufficientData: 0 },
        recentErrors: [],
        buildState: 'SUCCEED',
      };
    case 'degraded':
      return {
        provisioned: true,
        metrics: { errors: 20, invocations: 1000 }, // 2% -> warn band
        alarms: { alarm: 0, ok: 2, insufficientData: 2 },
        recentErrors: [{ timestamp: 1_700_000_000_000, message: 'WARN slow response' }],
        buildState: 'SUCCEED',
      };
    case 'error':
      return {
        provisioned: true,
        metrics: { errors: 100, invocations: 1000 }, // 10% -> error
        alarms: { alarm: 2, ok: 1, insufficientData: 0 },
        recentErrors: [
          { timestamp: 1_700_000_000_000, message: 'ERROR unhandled exception' },
          { timestamp: 1_700_000_060_000, message: 'ERROR database timeout' },
        ],
        buildState: 'FAILED',
      };
    case 'unknown':
      return {
        provisioned: true,
        readFailed: true,
        readFailureReason: 'AssumeRole failed (trust not yet deployed)',
      };
    case 'not_provisioned':
    default:
      return { provisioned: false };
  }
}

export interface RecordedFetch {
  target: ClientMonitoringTarget;
}

export class MockMonitoringSource implements MonitoringSource {
  readonly fetches: RecordedFetch[] = [];
  private readonly state: MockHealthState;

  constructor(state: MockHealthState = 'not_provisioned') {
    this.state = state;
  }

  /** Every call records the EXACT target it was given (per-client isolation, AC8). */
  async fetch(target: ClientMonitoringTarget): Promise<RawMonitoringPayload> {
    this.fetches.push({ target: { ...target } });
    return cannedPayload(this.state);
  }
}
