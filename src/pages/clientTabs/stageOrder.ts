/**
 * Pure stage-ordering helpers for the tabbed Client workspace (FEAT-004).
 *
 * Client.stage is an 8-value enum (FEAT-002) with NO DB default; a null stage
 * is treated as the first stage, 'quote_requested'. The 8 workspace tabs map
 * 1:1 onto those stages in a fixed left-to-right order. advanceStage is
 * forward-only: it may raise a client's stage but never lower it, which is why
 * the ordering lives here as a tested pure module.
 */

export type Stage =
  | 'quote_requested'
  | 'demo_details'
  | 'demo_build'
  | 'agreement'
  | 'payment_setup'
  | 'project'
  | 'post_sale'
  | 'monthly_service';

export type TabSlug =
  | 'quote-requested'
  | 'demo-details'
  | 'demo-build'
  | 'agreement'
  | 'payment-setup'
  | 'project'
  | 'post-sale'
  | 'monthly-service';

/** Canonical left-to-right order of the 8 stages / tabs. */
export const STAGE_ORDER: Stage[] = [
  'quote_requested',
  'demo_details',
  'demo_build',
  'agreement',
  'payment_setup',
  'project',
  'post_sale',
  'monthly_service',
];

/** Parallel list of URL slugs, index-aligned with STAGE_ORDER. */
export const TAB_SLUGS: TabSlug[] = [
  'quote-requested',
  'demo-details',
  'demo-build',
  'agreement',
  'payment-setup',
  'project',
  'post-sale',
  'monthly-service',
];

/** slug -> stage */
export const SLUG_TO_STAGE: Record<TabSlug, Stage> = TAB_SLUGS.reduce(
  (acc, slug, i) => {
    acc[slug] = STAGE_ORDER[i];
    return acc;
  },
  {} as Record<TabSlug, Stage>,
);

/** stage -> slug */
export const STAGE_TO_SLUG: Record<Stage, TabSlug> = STAGE_ORDER.reduce(
  (acc, stage, i) => {
    acc[stage] = TAB_SLUGS[i];
    return acc;
  },
  {} as Record<Stage, TabSlug>,
);

/** Human-readable tab labels, index-aligned with STAGE_ORDER. */
export const STAGE_LABELS: Record<Stage, string> = {
  quote_requested: 'Quote Requested',
  demo_details: 'Demo Details',
  demo_build: 'Demo Build',
  agreement: 'Agreement',
  payment_setup: 'Payment Setup',
  project: 'Project',
  post_sale: 'Post-Sale',
  monthly_service: 'Monthly Service',
};

/** A null/unknown stage coalesces to the first stage, 'quote_requested'. */
export function coalesceStage(stage: string | null | undefined): Stage {
  if (stage && (STAGE_ORDER as string[]).includes(stage)) {
    return stage as Stage;
  }
  return 'quote_requested';
}

/** Index of a stage within STAGE_ORDER (null-safe via coalesceStage). */
export function stageIndex(stage: string | null | undefined): number {
  return STAGE_ORDER.indexOf(coalesceStage(stage));
}

/**
 * Forward-only merge: returns whichever of `current`/`next` is further along
 * the pipeline. Never lowers a stage. Both args are null-safe.
 */
export function maxStage(
  current: string | null | undefined,
  next: string | null | undefined,
): Stage {
  return stageIndex(next) > stageIndex(current)
    ? coalesceStage(next)
    : coalesceStage(current);
}

/** The next stage after `stage`, or null if `stage` is terminal. */
export function nextStage(stage: string | null | undefined): Stage | null {
  const i = stageIndex(stage);
  return i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null;
}
