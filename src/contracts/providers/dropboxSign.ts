/**
 * Dropbox Sign (HelloSign) e-sign adapter (FEAT-001).
 *
 * SECRET HANDLING: the API key is read ONLY from the backend Lambda env
 * (process.env.DROPBOX_SIGN_API_KEY). It is NEVER hardcoded, committed, or
 * exposed to the frontend. When the key is absent the adapter is a clean no-op:
 * `configured()` returns false and `createSignatureRequest` returns
 * { configured: false } WITHOUT making any network call, so callers fall back
 * to the fully-functional manual_upload path.
 *
 * This file is intended to run in the backend adapter/Lambda context, not the
 * browser. The live Dropbox Sign HTTP call is a NEEDS-MANUAL-VERIFICATION seam
 * and is left as a labeled TODO behind the configured() gate below.
 */

import type {
  ESignProvider,
  CreateSignatureRequestInput,
  CreateSignatureRequestResult,
} from './types';

/**
 * Read the backend-only secret from the process env WITHOUT depending on
 * `@types/node` (the frontend tsconfig has no node types). We reach `process`
 * through `globalThis` with a narrow local shape and guard defensively so this
 * never throws in a browser bundle and never leaks a value. The key lives only
 * in the Lambda env.
 */
function apiKey(): string | undefined {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env?.DROPBOX_SIGN_API_KEY;
}

export const dropboxSign: ESignProvider = {
  configured(): boolean {
    return Boolean(apiKey());
  },

  async createSignatureRequest(
    input: CreateSignatureRequestInput,
  ): Promise<CreateSignatureRequestResult> {
    const key = apiKey();
    if (!key) {
      // Not configured: no network call, caller falls back to manual.
      return { configured: false };
    }

    // TODO(dropbox-sign-live): wire the real Dropbox Sign signature_request
    // call here, behind this configured() gate. Use `key` as the HTTP Basic
    // auth username against https://api.hellosign.com/v3/signature_request/send
    // with `input.documentKey` (resolved to a file/URL), `input.signerName`,
    // and `input.signerEmail`; map the response to { envelopeId, signingUrl }.
    // This is a NEEDS-MANUAL-VERIFICATION seam — not exercised by the build.
    void input;
    return { configured: true };
  },
};
