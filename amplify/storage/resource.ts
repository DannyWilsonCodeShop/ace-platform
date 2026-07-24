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
    // Equipment photos
    'equipment/*': [
      allow.groups(['owner', 'manager']).to(['read', 'write', 'delete']),
      allow.groups(['crew']).to(['read']),
    ],
  }),
});
