/**
 * ============================================================================
 * NON-INVOKED LIVE SEAM — REFERENCE TEXT ONLY. DO NOT IMPORT. DO NOT RUN.
 * ============================================================================
 *
 * This file is listed in tsconfig.json "exclude", so `tsc` NEVER type-checks it
 * and the un-installed `@aws-sdk/*` imports below do NOT break `npm run build`
 * (design §1.2). It is NOT imported by the app or any test (AC6). It documents
 * the EXACT cross-account read path the external Lambda will run once the
 * per-client ACEMonitoringReadOnly role is deployed and reviewed by Dan.
 *
 * NOTHING HERE EXECUTES. No real STS AssumeRole, no real CloudWatch/Logs read.
 *
 * Per-client isolation is structural (design §4.2): assumeClientRole takes the
 * target BY VALUE, the assumed credentials are created per call and discarded
 * after use, and there is NO module-level or shared credential.
 */

// NOTE: these packages are intentionally NOT in package.json for this repo.
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts';
import {
  CloudWatchClient,
  GetMetricDataCommand,
  DescribeAlarmsCommand,
} from '@aws-sdk/client-cloudwatch';
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';

import type {
  ClientMonitoringTarget,
  MonitoringSource,
  RawMonitoringPayload,
} from './types';

/**
 * Assume exactly one client's read-only role. Credentials are returned to the
 * caller and must be discarded after the single fetch — never cached, never
 * shared across clients.
 */
async function assumeClientRole(
  accountId: string,
  roleArn: string,
  externalId: string,
): Promise<{ accessKeyId: string; secretAccessKey: string; sessionToken: string }> {
  // A fresh STS client per call — no shared credential at module scope.
  const sts = new STSClient({});
  const res = await sts.send(
    new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: `ace-monitor-${accountId}`,
      ExternalId: externalId, // per-client external id — binds the assume to one client
      DurationSeconds: 900,
    }),
  );
  const c = res.Credentials;
  if (!c?.AccessKeyId || !c.SecretAccessKey || !c.SessionToken) {
    throw new Error('AssumeRole returned no credentials');
  }
  return {
    accessKeyId: c.AccessKeyId,
    secretAccessKey: c.SecretAccessKey,
    sessionToken: c.SessionToken,
  };
}

/**
 * The live source. Returns the same RawMonitoringPayload shape the mock does, so
 * `toMonitoringViewModel` is unchanged whether fed mock or live data.
 */
export class AwsMonitoringSource implements MonitoringSource {
  async fetch(target: ClientMonitoringTarget): Promise<RawMonitoringPayload> {
    // 1. Assume ONLY this client's role; credentials discarded when this returns.
    const creds = await assumeClientRole(target.accountId, target.roleArn, target.externalId);
    const credentials = {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    };

    // 2. Read-only CloudWatch metrics + alarms with the assumed credentials.
    const cw = new CloudWatchClient({ credentials });
    const metricData = await cw.send(new GetMetricDataCommand({ MetricDataQueries: [], StartTime: new Date(0), EndTime: new Date() }));
    const alarms = await cw.send(new DescribeAlarmsCommand({}));

    // 3. Recent error log events (ERROR/Exception patterns).
    const logs = new CloudWatchLogsClient({ credentials });
    const events = await logs.send(
      new FilterLogEventsCommand({ filterPattern: 'ERROR', limit: 10 }),
    );

    // Live impl maps metricData/alarms/events into RawMonitoringPayload. The
    // reference seam leaves the mapping as documentation.
    void metricData;
    void alarms;
    void events;
    return { provisioned: true, readFailed: true, readFailureReason: 'reference seam — not implemented' };
  }
}
