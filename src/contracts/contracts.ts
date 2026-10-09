/**
 * Contract document S3 helpers (FEAT-001).
 *
 * Mirrors the notes.ts / demos.ts v6 Storage pattern (dynamic
 * `aws-amplify/storage` import, PATH-based uploadData/getUrl — the legacy
 * key/accessLevel shape silently fails in v6). Contract PDFs (unsigned +
 * signed) live under `clients/{clientId}/contracts/*`, reusing the existing
 * storage rule (owner/manager read-write-delete; signed-in customer identity
 * read).
 *
 * Unlike demos.ts, contract PDFs are uploaded verbatim: there is NO canvas /
 * downscale step (downscaling is image-only — a PDF must not be rasterized).
 *
 * CAVEAT (NEEDS-MANUAL-VERIFICATION): the Amplify {entity_id} token resolves to
 * the caller's own Cognito identity id, not the DB Client.id. A customer's
 * signed GET URL for clients/{clientId}/contracts/* may be denied when
 * clientId != their identity id (same latent seam as the demo flow). Callers
 * must show a graceful "document unavailable" fallback; manual type-to-sign
 * does NOT depend on resolving this URL.
 */

/** Build a URL-safe slug for a contract label. Stable, lowercase, hyphenated. */
export function slugify(name: string): string {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'contract';
}

/**
 * Upload a contract PDF to S3 and return the stored path. The file is uploaded
 * as-is with contentType `application/pdf` — NO image downscaling is applied.
 * Path: `clients/{clientId}/contracts/{slug}-{ts}.pdf`. Errors surface to the
 * caller so the admin upload form can report a failure.
 */
export async function uploadContractPdf(
  clientId: string,
  file: File | Blob,
  label: string,
): Promise<string> {
  const { uploadData } = await import('aws-amplify/storage');
  const slug = slugify(label);
  const path = `clients/${clientId}/contracts/${slug}-${Date.now()}.pdf`;
  await uploadData({
    path,
    data: file,
    options: { contentType: 'application/pdf' },
  }).result;
  return path;
}

/** Resolve a short-lived signed GET URL for a stored contract PDF. */
export async function contractUrl(key: string): Promise<string | null> {
  if (!key) return null;
  try {
    const { getUrl } = await import('aws-amplify/storage');
    const { url } = await getUrl({ path: key, options: { expiresIn: 3600 } });
    return url.toString();
  } catch {
    return null;
  }
}
