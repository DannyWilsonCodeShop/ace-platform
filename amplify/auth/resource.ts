import { defineAuth } from '@aws-amplify/backend';

/**
 * ACE Platform Auth Configuration
 * 
 * Uses Cognito User Pool with groups for role-based access:
 * - owner: Full access to everything
 * - manager: Can manage quotes, gigs, clients, invoices, crew
 * - crew: Can see assigned gigs, update checklists, view equipment
 * - performer: Can see assigned gigs and event details
 * - customer: Can see own gigs, invoices, send messages
 * - developer: Software builders — read+update on Project/ProjectPage (and
 *   read+update on MaintenanceWindow). Separate from the event-centric
 *   crew/performer roles so software work has its own builder group.
 * 
 * MFA enabled for admin roles.
 */

export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    preferredUsername: { required: false },
    phoneNumber: { required: false },
  },
  groups: ['owner', 'manager', 'crew', 'performer', 'customer', 'developer'],
  multifactor: {
    mode: 'OPTIONAL',
    sms: true,
    totp: true,
  },
  accountRecovery: 'EMAIL_ONLY',
});
