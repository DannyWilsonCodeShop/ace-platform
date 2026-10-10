# Cross-account monitoring role — `ACEMonitoringReadOnly` (DOCUMENT ONLY)

> **NO IAM ROLE IS CREATED IN THIS BUILD.** This file documents the trust and
> permission policies the external monitoring Lambda path expects to exist in
> each client member account. The role is deployed into each client account
> **later** (ideally by the provisioning wizard's `scaffold-amplify-app` step,
> design §3.6 / §4.1), reviewed by Dan. Nothing here applies a policy or calls
> IAM. (design §4.1, AC9)

## Trust policy (who may assume the role)

Principal is **only** the ACE studio account `463470937777` — no wildcard — and
every assume is bound to a **per-client `sts:ExternalId`**. The external id is a
random, per-client value supplied as config and **never committed**. The literal
`<PER_CLIENT_EXTERNAL_ID>` below is a placeholder, not a real secret.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::463470937777:root" },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": { "sts:ExternalId": "<PER_CLIENT_EXTERNAL_ID>" }
      }
    }
  ]
}
```

- Principal is pinned to account `463470937777` (ACE). No `"*"` principal.
- The `sts:ExternalId` condition means a stolen role ARN alone cannot be
  assumed — the caller must also present that one client's external id. This is
  the structural guarantee behind the per-client isolation in `source.ts` /
  `source.live.ts`.

## Permission policy (minimal, read-only)

Only the reads the "App health" card needs. **No write, no delete, no IAM, no
data-plane access.** Scope `Resource` to the client app's log groups / metrics /
app ARNs where possible (shown as `*` here for documentation).

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricData",
        "cloudwatch:ListMetrics",
        "cloudwatch:DescribeAlarms",
        "logs:FilterLogEvents",
        "logs:DescribeLogGroups",
        "amplify:GetApp",
        "amplify:ListApps"
      ],
      "Resource": "*"
    }
  ]
}
```

## Explicitly out of scope for this build

- No `iam:CreateRole` / `iam:PutRolePolicy` is executed.
- No `sts:AssumeRole` is executed against any live client account.
- No CloudWatch / Logs read is executed.

These run only from the external Lambda, after the role is deployed and reviewed.
