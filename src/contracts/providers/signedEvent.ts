/**
 * Signed-event handler (FEAT-001).
 *
 * TODO(webhook-wiring): there is no HTTP endpoint we can wire cleanly in this
 * build. The repo's API Gateway (/notify) is external and NOT managed by
 * amplify/backend.ts, and the existing Lambda functions
 * (create-user, notification-handler) are not defined via defineFunction or
 * wired into defineBackend. Rather than fake an endpoint, this exposes the
 * signed-event state transition as a plain exported function. When a real
 * Dropbox Sign webhook (or a manual "mark signed" action) can be delivered,
 * call applySignedEvent() with the event payload. The caller supplies the
 * data accessors (loadContract/updateContract/updateProject) so this stays
 * side-effect-driven through the existing api.ts CRUD and does not assume a
 * runtime context.
 *
 * On a signed event this flips Contract.status -> 'signed', stores the
 * signedDocumentKey, sets signedAt, and sets the parent Project.status ->
 * 'active'. Manual mode remains fully functional independent of this seam.
 *
 * Live webhook delivery, signature verification, and SES delivery are
 * NEEDS-MANUAL-VERIFICATION — not exercised by the build.
 */

/** Payload describing a completed signing, from a webhook or a manual action. */
export interface ContractSignedEvent {
  /** The ACE Contract.id that was signed. */
  contractId: string;
  /** The parent Project.id, flipped to 'active' on signing. */
  projectId: string;
  /** S3 path of the signed artifact, if one was produced. */
  signedDocumentKey?: string;
  /** ISO timestamp of signing; defaults to now when omitted. */
  signedAt?: string;
}

/** Data accessors the caller injects (the existing api.ts CRUD helpers). */
export interface SignedEventDeps {
  updateContract: (input: Record<string, any>) => Promise<any>;
  updateProject: (input: Record<string, any>) => Promise<any>;
}

/**
 * Apply a contract-signed event: mark the Contract signed (+ signedAt +
 * signedDocumentKey) and flip the parent Project to 'active'. Returns the
 * updated contract + project. Errors surface to the caller.
 */
export async function applySignedEvent(
  event: ContractSignedEvent,
  deps: SignedEventDeps,
): Promise<{ contract: any; project: any }> {
  const signedAt = event.signedAt || new Date().toISOString();

  const contract = await deps.updateContract({
    id: event.contractId,
    status: 'signed',
    signedAt,
    ...(event.signedDocumentKey ? { signedDocumentKey: event.signedDocumentKey } : {}),
  });

  const project = await deps.updateProject({
    id: event.projectId,
    status: 'active',
  });

  return { contract, project };
}
