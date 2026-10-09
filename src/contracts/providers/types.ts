/**
 * E-sign provider seam (FEAT-001).
 *
 * BINDING DECISION "integrate but allow both": the manual_upload path is fully
 * functional with no external account; an e-sign provider is an optional
 * adapter behind this interface, gated on its own secret so it cleanly no-ops
 * (reports configured:false) when the key is absent. Manual remains the
 * default.
 */

/** Input for creating a signature request against an e-sign provider. */
export interface CreateSignatureRequestInput {
  /** The ACE Contract.id this request is for. */
  contractId: string;
  /** S3 path of the unsigned document to send for signature, if any. */
  documentKey?: string;
  /** Display name of the signer. */
  signerName?: string;
  /** Email the provider should deliver the signing request to. */
  signerEmail?: string;
}

/** Result of a createSignatureRequest call. */
export interface CreateSignatureRequestResult {
  /** False when the provider is not configured (no secret) — caller falls back to manual. */
  configured: boolean;
  /** External e-sign envelope / signature-request reference, if created. */
  envelopeId?: string;
  /** URL the signer can be redirected to, if the provider returns one. */
  signingUrl?: string;
}

/**
 * Common interface every e-sign adapter implements. `configured()` lets callers
 * decide whether to offer the provider flow or stay on the manual path.
 */
export interface ESignProvider {
  /** True only when the provider's secret is present in the (backend) env. */
  configured(): boolean;
  /**
   * Create a signature request. MUST make NO network call and return
   * { configured: false } when the provider is not configured.
   */
  createSignatureRequest(
    input: CreateSignatureRequestInput,
  ): Promise<CreateSignatureRequestResult>;
}
