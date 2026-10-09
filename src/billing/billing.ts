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
 * Return the Stripe publishable key, or undefined when unset. Reads the Vite
 * build-time env first, then falls back to an optional `custom.stripePublishableKey`
 * field on amplify_outputs if the backend ever surfaces one. Never a literal.
 */
export function publishableKey(): string | undefined {
  // Read the Vite build-time env defensively — this repo has no `vite/client`
  // types reference, so `import.meta.env` is untyped; narrow it locally without
  // depending on a global ambient declaration.
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  const fromEnv = meta.env?.VITE_STRIPE_PUBLISHABLE_KEY;
  if (fromEnv) return fromEnv;

  const fromOutputs = (outputs as any)?.custom?.stripePublishableKey;
  return typeof fromOutputs === 'string' && fromOutputs ? fromOutputs : undefined;
}

/**
 * Convenience the UI can call to decide between the live-ish billing flow and
 * the "billing not connected" state. This reflects only the frontend's view
 * (presence of a publishable key); the backend adapter's configured() is the
 * authoritative gate for any live Stripe call.
 */
export function billingConfigured(): boolean {
  return Boolean(publishableKey());
}
