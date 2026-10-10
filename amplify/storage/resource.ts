import { defineStorage } from '@aws-amplify/backend';

/**
 * ACE Platform Storage
 * 
 * S3 bucket for:
 * - Contracts and signed agreements
 * - Event riders / technical specs
 * - Invoice PDFs
 * - Client uploads (photos, logos for events)
 * - Equipment photos
 */

export const storage = defineStorage({
  name: 'aceFiles',
  access: (allow) => ({
    // Admin files — only owner/manager can access
    'admin/*': [
      allow.groups(['owner', 'manager']).to(['read', 'write', 'delete']),
    ],
    // Gig files — crew can read, admin can write
    'gigs/{entity_id}/*': [
      allow.groups(['owner', 'manager']).to(['read', 'write', 'delete']),
      allow.groups(['crew', 'performer']).to(['read']),
    ],
    // Client-visible files (contracts, invoices).
    // The customer-group read is what actually resolves customer reads here:
    // these paths are keyed by a DynamoDB clientId (e.g.
    // clients/${clientId}/contracts/...), NOT the Cognito identity-pool id, so
    // allow.entity('identity') never matches and is kept only for the (unused)
    // identity-id-keyed case. The group read lets a signed-in customer fetch a
    // signed GET URL for their own contract/invoice PDFs.
    'clients/{entity_id}/*': [
      allow.groups(['owner', 'manager']).to(['read', 'write', 'delete']),
      allow.groups(['customer']).to(['read']),
      allow.entity('identity').to(['read']), // kept (harmless) for identity-id-keyed paths
    ],
    // Project voice notes — the signed-in customer can upload/play their own
    // voice notes (REQUIRED deliverable, not a seam). Paths are keyed by a
    // DynamoDB projectId (project/${projectId}/notes/...); access is entirely
    // GROUP-based (the old allow.entity('identity') never matched a projectId
    // and Amplify forbids {entity_id} anywhere but the segment right before the
    // trailing wildcard, so it is removed). The customer-group read+write grant
    // is what resolves customer record+play.
    // TRACKED OVER-GRANT (see ace-lifecycle-followups.md TD-3): group auth is
    // prefix-level, so this permits a raw call to write under ANY project
    // notes prefix, not just the caller's own project. The portal UI scopes
    // uploads to the signed-in user's project; a per-project constraint (custom
    // resolver/presign) is the durable fix, deferred. Builders get read-only.
    'project-notes/*': [
      allow.groups(['owner', 'manager']).to(['read', 'write', 'delete']),
      allow.groups(['customer']).to(['read', 'write']),
      allow.groups(['developer']).to(['read']),
    ],
    // Project demo / choice-board images (FEAT-003). Owner/manager own the
    // assets (they create & share demos); developer read-only; customer read
    // (review UI resolves a signed GET URL), no customer write. Same projectId-
    // keyed, group-based access as notes; {entity_id} removed for the same
    // Amplify path-rule reason.
    'project-demos/*': [
      allow.groups(['owner', 'manager']).to(['read', 'write', 'delete']),
      allow.groups(['customer']).to(['read']),
      allow.groups(['developer']).to(['read']),
    ],
    // Equipment photos
    'equipment/*': [
      allow.groups(['owner', 'manager']).to(['read', 'write', 'delete']),
      allow.groups(['crew']).to(['read']),
    ],
  }),
});
