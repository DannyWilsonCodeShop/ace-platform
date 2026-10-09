/**
 * Demo / choice-board S3 image helpers (FEAT-003).
 *
 * Mirrors the notes.ts v6 Storage pattern (dynamic `aws-amplify/storage`
 * import, PATH-based uploadData/getUrl — the legacy key/accessLevel shape
 * silently fails in v6). Demo images live under `project/{projectId}/demos/*`
 * (storage rule: owner/manager read-write-delete, developer read, signed-in
 * customer identity read for the signed-GET review UI).
 *
 * The user previously hit a hard failure uploading large images, so every
 * upload is downscaled client-side to a max longest edge of 2000px (never
 * upscaled) via a canvas before it is sent to S3.
 */

/** Max longest-edge, in px, we allow a demo image to be stored at. */
const MAX_EDGE = 2000;

/** Build a URL-safe slug for an option name. Stable, lowercase, hyphenated. */
export function slugify(name: string): string {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'option';
}

/** Pick a canvas export mime + file extension from the source file type. */
function outputFormat(file: File): { type: string; ext: string } {
  // PNG preserves transparency; everything else exports as JPEG (smaller).
  if (file.type === 'image/png') return { type: 'image/png', ext: 'png' };
  return { type: 'image/jpeg', ext: 'jpg' };
}

/**
 * Downscale an image File so its longest edge is at most `maxEdge` px. Images
 * already within the cap are NOT upscaled (scale is clamped to <= 1). Draws to
 * a canvas and returns a Blob (PNG for PNG sources, JPEG otherwise at q~0.85).
 * Rejects if the file cannot be decoded or the canvas export fails.
 */
export async function downscaleImage(file: File, maxEdge = MAX_EDGE): Promise<Blob> {
  const { type, ext } = outputFormat(file);
  const bitmap = await loadBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    // Never upscale: clamp the scale factor at 1.
    const scale = longest > maxEdge ? maxEdge / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, type === 'image/jpeg' ? 0.85 : undefined),
    );
    if (!blob) throw new Error('Canvas export (toBlob) returned null');
    // Tag the blob type so uploadDemoImage can derive contentType/ext.
    return blob.type ? blob : new Blob([blob], { type });
  } finally {
    // createImageBitmap results should be released when done.
    if ('close' in bitmap && typeof (bitmap as ImageBitmap).close === 'function') {
      (bitmap as ImageBitmap).close();
    }
    // ext is used by the caller via outputFormat; keep lint quiet.
    void ext;
  }
}

/**
 * Decode a File into something drawable on a canvas. Prefers createImageBitmap
 * (fast, off-main-thread decode); falls back to an HTMLImageElement + object
 * URL where createImageBitmap is unavailable.
 */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image'));
    };
    img.src = url;
  });
}

/**
 * Downscale `file` (<= 2000px longest edge) and upload it to
 * `project/{projectId}/demos/{slug}-{ts}.{ext}`. Returns the stored path
 * (the imageKey persisted in Demo.options). Errors surface to the caller so
 * the admin create form can report an upload failure.
 */
export async function uploadDemoImage(
  projectId: string,
  file: File,
  slug: string,
): Promise<string> {
  const { ext } = outputFormat(file);
  const blob = await downscaleImage(file);
  const { uploadData } = await import('aws-amplify/storage');
  const safeSlug = slugify(slug);
  const path = `project/${projectId}/demos/${safeSlug}-${Date.now()}.${ext}`;
  await uploadData({
    path,
    data: blob,
    options: { contentType: blob.type || 'image/jpeg' },
  }).result;
  return path;
}

/** Resolve a short-lived signed GET URL for a stored demo image. */
export async function demoImageUrl(imageKey: string): Promise<string | null> {
  if (!imageKey) return null;
  try {
    const { getUrl } = await import('aws-amplify/storage');
    const { url } = await getUrl({ path: imageKey, options: { expiresIn: 3600 } });
    return url.toString();
  } catch {
    return null;
  }
}
