/**
 * Live cross-account CloudWatch monitoring — pure data-shaper types (design §4.2-§4.3).
 *
 * No type here imports an AWS SDK. The live source (source.live.ts) is
 * tsconfig-excluded and NON-INVOKED (AC6). Per-client isolation is STRUCTURAL:
 * every fetch takes a ClientMonitoringTarget BY VALUE — there is no module-level
 * or shared credential (NFR3, design §4.2).
 */

/** The health status derived by `toMonitoringViewModel` (design §4.3 table). */
export type HealthStatus =
  | 'healthy'
  | 'degraded'
  | 'error'
  | 'unknown'
  | 'not_provisioned';

/**
 * The per-fetch, per-client assume-role target. Passed by value on EVERY call;
 * naming exactly one client's account/role/external-id. There is no default and
 * no shared value — a monitoring read cannot be made without one of these.
 */
export interface ClientMonitoringTarget {
  accountId: string;
  roleArn: string;
  externalId: string;
}

/** A single recent error log line (from logs:FilterLogEvents). */
export interface RawLogEvent {
  timestamp: number;
  message: string;
}

/** CloudWatch alarm state counts (from cloudwatch:DescribeAlarms). */
export interface RawAlarmCounts {
  alarm: number;
  ok: number;
  insufficientData: number;
}

/** Latest Amplify build/deploy state (from amplify:GetApp). */
export type BuildState = 'SUCCEED' | 'FAILED' | 'RUNNING' | 'UNKNOWN';

/**
 * The raw payload a MonitoringSource returns. `provisioned:false` models the
 * common case today (no account/role yet). `readFailed:true` models a failed
 * assume-role or CloudWatch read (-> 'unknown').
 */
export interface RawMonitoringPayload {
  provisioned: boolean;
  readFailed?: boolean;
  readFailureReason?: string;
  /** Lambda/API error metrics over the trailing window. */
  metrics?: {
    errors: number;
    invocations: number;
  };
  alarms?: RawAlarmCounts;
  recentErrors?: RawLogEvent[];
  buildState?: BuildState;
}

/** A shaped recent-error line for the card. */
export interface ErrorLogLine {
  timestamp: number;
  isoTime: string;
  message: string;
}

/** The dashboard view model rendered by the "App health" card (design §4.3). */
export interface MonitoringViewModel {
  status: HealthStatus;
  statusReason: string;
  /** Trailing-window error rate as a percentage (0-100), or null when unknown. */
  errorRatePct: number | null;
  alarmCounts: RawAlarmCounts;
  recentErrors: ErrorLogLine[];
  buildState: BuildState;
  /** Epoch ms the view model was shaped at. */
  shapedAt: number;
}

/**
 * The source seam. The MOCK (source.ts) is the only implementation imported by
 * the app or tests in this build. The LIVE source (source.live.ts) is
 * tsconfig-excluded and NON-INVOKED (AC6). `fetch` REQUIRES a target by value.
 */
export interface MonitoringSource {
  fetch(target: ClientMonitoringTarget): Promise<RawMonitoringPayload>;
}
