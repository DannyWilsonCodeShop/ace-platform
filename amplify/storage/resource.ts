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
    // Client-visible files (contracts, invoices)
    'clients/{entity_id}/*': [
      allow.groups(['owner', 'manager']).to(['read', 'write', 'delete']),
      allow.entity('identity').to(['read']), // customer sees own files
    ],
    // Project voice notes — the signed-in customer can upload/play their own
    // voice notes (REQUIRED deliverable, not a seam). Mirrors the
    // clients/{entity_id}/* customer rule but grants write so a customer can
    // record. Builders (developer) get read-only.
    'project/{entity_id}/notes/*': [
      allow.groups(['owner', 'manager']).to(['read', 'write', 'delete']),
      allow.groups(['developer']).to(['read']),
      allow.entity('identity').to(['read', 'write']),
    ],
    // Equipment photos
    'equipment/*': [
      allow.groups(['owner', 'manager']).to(['read', 'write', 'delete']),
      allow.groups(['crew']).to(['read']),
    ],
  }),
});
