/**
 * Template registry for the ACE project-management lifecycle.
 *
 * `Project.templateKey` names a template here. New client/app = add (or clone)
 * a template; no schema change needed. `getTemplate` defaults to the
 * `app-build` template when a key is missing or unknown.
 */

import type { ProjectTemplate } from './types';
import { appBuildTemplate } from './app-build';

export const DEFAULT_TEMPLATE_KEY = 'app-build';

export const TEMPLATES: Record<string, ProjectTemplate> = {
  [appBuildTemplate.key]: appBuildTemplate,
};

/**
 * Resolve a template by key, falling back to the default app-build template.
 *
 * Returns a fresh copy each call (with its own `launch` object) so callers can
 * safely overlay a project's stored launch window / backendCeiling without
 * mutating the shared registry singleton — otherwise concurrent list rendering
 * would cross-contaminate per-project launch-window progress.
 */
export function getTemplate(key?: string | null): ProjectTemplate {
  const base = (key && TEMPLATES[key]) || TEMPLATES[DEFAULT_TEMPLATE_KEY];
  return { ...base, launch: { ...base.launch } };
}

export type { Category, Owner, TrackedItem, ProjectTemplate } from './types';
export { appBuildTemplate };
