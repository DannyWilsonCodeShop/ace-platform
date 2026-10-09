/**
 * Progress math for the project dashboard.
 *
 * Ported from Green-Casting `src/dashboard/progress.ts`, generalized to
 * per-project inputs: instead of importing a single global config
 * (LAUNCH / BACKEND_CEILING / FRONTEND / BACKEND / MIDDLEWARE), every function
 * takes a `ProjectTemplate` (the item arrays + launch window + backendCeiling)
 * so the same math serves any number of projects.
 *
 * Frontend & middleware show their honest current state (average of each
 * item's completion). Backend uses a "daily drip": it climbs a little each day
 * toward `backendCeiling` as the launch date approaches, so the client sees
 * steady motion — but it is capped at the real backend completion so it never
 * overstates what is actually done.
 */

import type { Category, ProjectTemplate, TrackedItem } from './templates/types';

/** Mutable per-item state (mirrors the ProjectPage model fields). */
export interface PageState {
  pageKey: string;
  devStatus?: string | null;
  lookComplete?: boolean | null;
  featuresComplete?: boolean | null;
  clientApproval?: number | null;
}

/** Honest completion for one item, blending its baseline with any live state. */
export function itemCompletion(item: TrackedItem, state?: PageState): number {
  // If dev has marked both look and features complete, treat as 100.
  if (state?.lookComplete && state?.featuresComplete) return 100;
  // If one of the two is complete, lift toward the midpoint.
  let pct = item.baseline;
  if (state?.lookComplete || state?.featuresComplete) {
    pct = Math.max(pct, 60);
  }
  if (state?.devStatus === 'COMPLETE') pct = 100;
  else if (state?.devStatus === 'READY_FOR_REVIEW') pct = Math.max(pct, 80);
  else if (state?.devStatus === 'AWAITING_FEEDBACK') pct = Math.max(pct, 70);
  return Math.min(100, pct);
}

export function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/** Fraction of the schedule elapsed, 0..1, from start to target. */
export function scheduleElapsed(template: ProjectTemplate, now: Date = new Date()): number {
  const start = new Date(template.launch.start + 'T00:00:00').getTime();
  const target = new Date(template.launch.target + 'T00:00:00').getTime();
  const t = (now.getTime() - start) / (target - start);
  return Math.max(0, Math.min(1, t));
}

export function daysToLaunch(template: ProjectTemplate, now: Date = new Date()): number {
  const target = new Date(template.launch.target + 'T00:00:00').getTime();
  return Math.ceil((target - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Real backend completion (what we actually have), from baselines + state. */
export function backendReal(template: ProjectTemplate, states: Map<string, PageState>): number {
  return avg(template.backend.map((i) => itemCompletion(i, states.get(i.key))));
}

/**
 * Backend displayed value: a drip from a modest floor up to backendCeiling
 * across the schedule, capped at the real completion so it never exceeds
 * what's genuinely done.
 */
export function backendDisplayed(
  template: ProjectTemplate,
  states: Map<string, PageState>,
  now: Date = new Date(),
): number {
  const real = backendReal(template, states);
  const floor = 15; // where the drip visually starts
  const drip = Math.round(floor + (template.backendCeiling - floor) * scheduleElapsed(template, now));
  return Math.min(real, template.backendCeiling, drip);
}

export function categoryDisplayed(
  cat: Category,
  template: ProjectTemplate,
  states: Map<string, PageState>,
  now: Date = new Date(),
): number {
  if (cat === 'backend') return backendDisplayed(template, states, now);
  const items = cat === 'frontend' ? template.frontend : template.middleware;
  return avg(items.map((i) => itemCompletion(i, states.get(i.key))));
}

export function overallDisplayed(
  template: ProjectTemplate,
  states: Map<string, PageState>,
  now: Date = new Date(),
): number {
  const allCount = template.frontend.length + template.backend.length + template.middleware.length;
  if (allCount === 0) return 0;
  // Weight by item count so the overall reflects the real spread of work.
  const fe = categoryDisplayed('frontend', template, states, now) * template.frontend.length;
  const be = categoryDisplayed('backend', template, states, now) * template.backend.length;
  const mw = categoryDisplayed('middleware', template, states, now) * template.middleware.length;
  return Math.round((fe + be + mw) / allCount);
}

/** On-track status: compare overall progress to schedule elapsed. */
export function trackStatus(
  template: ProjectTemplate,
  states: Map<string, PageState>,
  now: Date = new Date(),
): { label: string; tone: 'ontrack' | 'atrisk' | 'behind' } {
  const progress = overallDisplayed(template, states, now);
  const elapsed = scheduleElapsed(template, now) * 100;
  const gap = progress - elapsed;
  if (gap >= -5) return { label: 'On track', tone: 'ontrack' };
  if (gap >= -20) return { label: 'At risk', tone: 'atrisk' };
  return { label: 'Behind', tone: 'behind' };
}
