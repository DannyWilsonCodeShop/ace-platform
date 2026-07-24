import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';

/**
 * ACE Platform Backend
 * 
 * This wires together:
 * - Cognito (auth + roles)
 * - AppSync + DynamoDB (data API)
 * - S3 (file storage)
 * - Lambda functions are added via amplify/functions/
 * 
 * Deploy with: npx ampx sandbox (dev) or npx ampx deploy (prod)
 */

const backend = defineBackend({
  auth,
  data,
  storage,
});
