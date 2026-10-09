/**
 * Billing front-door helpers (FEAT-002).
 *
 * The frontend may know the Stripe PUBLISHABLE key (safe to ship to the
 * browser), but it can NEVER know the secret — the secret-gated truth lives in
 * the backend adapter (src/billing/providers/stripe.ts, configured()). So
 * `billingConfigured()` here only reflects whether a publishable key is wired;
 * it lets the UI choose between a live-ish billing affordance and a
 * "billing not connected" state. The authoritative gate for any live call
 * remains the backend adapter's configured().
 *
 * NEVER hardcode a key literal. The publishable key is read from the Vite env
 * (VITE_STRIPE_PUBLISHABLE_KEY), falling back to an optional field on the
 * generated amplify_outputs.json if one is present.
 */

import outputs from '../../amplify_outputs.json';

/**
 * The Stripe TEST publishable key. Publishable keys are frontend-safe by design
 * (Stripe exposes them in client code) — this is NOT the secret, which lives
 * only in the backend Lambda env. Overridable at build time via
 * VITE_STRIPE_PUBLISHABLE_KEY; swap to the live pk_live_... at go-live.
 */
const DEFAULT_TEST_PUBLISHABLE_KEY =
  'pk_test_51UOcaAQwBWCeA1ac3QYpKXX00SuDfvJuT8iTIMZbtfOdS5gWzwBFOf4TB5UcJGOaXIiZ7TXafT7eXRN0PUyM3ku600NMx7lKRZ';

/**
 * Return the Stripe publishable key. Reads the Vite build-time env first, then
 * falls back to an optional `custom.stripePublishableKey` field on
 * amplify_outputs, then to the frontend-safe TEST publishable key constant so
 * the live-ish checkout flow is always available in test. Never a secret.
 */
export function publishableKey(): string {
  // Read the Vite build-time env defensively — this repo has no `vite/client`
  // types reference, so `import.meta.env` is untyped; narrow it locally without
  // depending on a global ambient declaration.
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  const fromEnv = meta.env?.VITE_STRIPE_PUBLISHABLE_KEY;
  if (fromEnv) return fromEnv;

  const fromOutputs = (outputs as any)?.custom?.stripePublishableKey;
  if (typeof fromOutputs === 'string' && fromOutputs) return fromOutputs;

  return DEFAULT_TEST_PUBLISHABLE_KEY;
}

/**
 * Base URL of the backend billing API (the ACE-QuoteHandler API Gateway that
 * also hosts /notify). The gateway holds the Stripe secret; the frontend only
 * calls it. Overridable via VITE_BILLING_API.
 */
export function billingEndpoint(): string {
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  return (
    meta.env?.VITE_BILLING_API ??
    'https://zuq0ae5dqf.execute-api.us-east-1.amazonaws.com'
  );
}

/**
 * Convenience the UI can call to decide between the live-ish billing flow and
 * the "billing not connected" state. Keys off the presence of a publishable
 * key (always true in test now). The gateway holds the authoritative secret.
 */
export function billingConfigured(): boolean {
  return Boolean(publishableKey());
}
