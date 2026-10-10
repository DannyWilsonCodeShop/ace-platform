/**
 * Pure monitoring data-shaper (design §4.3-§4.4). No I/O, no AWS import.
 *
 * `toMonitoringViewModel(raw, now)` maps a raw CloudWatch payload (metrics +
 * alarms + recent error log events + build state) into the card view model and
 * a single health status, per the design §4.3 table. External JSON is treated
 * as untrusted and coerced; missing fields render as neutral defaults, never
 * `undefined`.
 */

import type {
  BuildState,
  ErrorLogLine,
  MonitoringViewModel,
  RawAlarmCounts,
  RawLogEvent,
  RawMonitoringPayload,
} from './types';

/** Error-rate thresholds (percent). At/above `error` -> error; at/above `warn` -> degraded. */
const WARN_ERROR_RATE_PCT = 1;
const ERROR_ERROR_RATE_PCT = 5;
/** Keep the recent-error list short and bounded. */
const MAX_RECENT_ERRORS = 10;

function coerceAlarmCounts(raw: RawAlarmCounts | undefined): RawAlarmCounts {
  return {
    alarm: Math.max(0, Number(raw?.alarm ?? 0) || 0),
    ok: Math.max(0, Number(raw?.ok ?? 0) || 0),
    insufficientData: Math.max(0, Number(raw?.insufficientData ?? 0) || 0),
  };
}

function coerceErrorRate(metrics: RawMonitoringPayload['metrics']): number | null {
  if (!metrics) return null;
  const invocations = Number(metrics.invocations);
  const errors = Number(metrics.errors);
  if (!Number.isFinite(invocations) || invocations <= 0) return null;
  if (!Number.isFinite(errors) || errors < 0) return null;
  return (errors / invocations) * 100;
}

function shapeRecentErrors(events: RawLogEvent[] | undefined): ErrorLogLine[] {
  if (!Array.isArray(events)) return [];
  return events.slice(0, MAX_RECENT_ERRORS).map((e) => {
    const ts = Number(e?.timestamp);
    const safeTs = Number.isFinite(ts) ? ts : 0;
    return {
      timestamp: safeTs,
      isoTime: new Date(safeTs).toISOString(),
      message: String(e?.message ?? ''),
    };
  });
}

export function toMonitoringViewModel(
  raw: RawMonitoringPayload,
  now: number,
): MonitoringViewModel {
  const alarmCounts = coerceAlarmCounts(raw?.alarms);
  const recentErrors = shapeRecentErrors(raw?.recentErrors);
  const buildState: BuildState = raw?.buildState ?? 'UNKNOWN';
  const errorRatePct = coerceErrorRate(raw?.metrics);

  // not_provisioned — the common case today: no account/role yet (design §4.3).
  if (!raw?.provisioned) {
    return {
      status: 'not_provisioned',
      statusReason: 'App not yet provisioned.',
      errorRatePct: null,
      alarmCounts,
      recentErrors,
      buildState,
      shapedAt: now,
    };
  }

  // unknown — assume-role or CloudWatch read failed (design §4.3-§4.4).
  if (raw.readFailed) {
    return {
      status: 'unknown',
      statusReason: raw.readFailureReason
        ? `Monitoring unavailable: ${raw.readFailureReason}`
        : 'Monitoring temporarily unavailable.',
      errorRatePct,
      alarmCounts,
      recentErrors,
      buildState,
      shapedAt: now,
    };
  }

  // error — any alarm in ALARM, error rate above threshold, or latest build failed.
  if (
    alarmCounts.alarm > 0 ||
    (errorRatePct !== null && errorRatePct >= ERROR_ERROR_RATE_PCT) ||
    buildState === 'FAILED'
  ) {
    return {
      status: 'error',
      statusReason: 'One or more alarms firing, error rate high, or latest build failed.',
      errorRatePct,
      alarmCounts,
      recentErrors,
      buildState,
      shapedAt: now,
    };
  }

  // degraded — some INSUFFICIENT_DATA alarms, or error rate in the warn band.
  if (
    alarmCounts.insufficientData > 0 ||
    (errorRatePct !== null && errorRatePct >= WARN_ERROR_RATE_PCT)
  ) {
    return {
      status: 'degraded',
      statusReason: 'Some alarms have insufficient data, or error rate is in the warn band.',
      errorRatePct,
      alarmCounts,
      recentErrors,
      buildState,
      shapedAt: now,
    };
  }

  // healthy — no alarms firing, error rate below threshold, latest build succeeded.
  return {
    status: 'healthy',
    statusReason: 'No alarms firing, error rate nominal, latest build succeeded.',
    errorRatePct,
    alarmCounts,
    recentErrors,
    buildState,
    shapedAt: now,
  };
}
