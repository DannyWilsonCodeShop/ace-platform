/**
 * Build-template types for the ACE project-management lifecycle.
 *
 * Ported from the Green-Casting agency dashboard (`src/dashboard/config.ts`)
 * and generalized: the *list* of pages/systems/items and their fixed metadata
 * live here in code (easy for the developer to edit as scope shifts). The
 * *mutable* state per item — devStatus, look/features complete, clientApproval
 * — lives in the backend (`ProjectPage`) keyed by `key` (the `pageKey`).
 *
 * A `ProjectTemplate` names the config a Project is seeded from
 * (`Project.templateKey`). New client/app = pick (or clone) a template; no
 * schema change needed.
 */

export type Category = 'frontend' | 'backend' | 'middleware';

/** Who is responsible for a middleware / setup item. */
export type Owner = 'client' | 'together' | 'dev';

export interface TrackedItem {
  /** Stable id, used as the DB key (ProjectPage.pageKey). */
  key: string;
  /** Display name. */
  label: string;
  category: Category;
  /** Optional link to open the page/preview (frontend items). */
  href?: string;
  /** Short description of what this item is / what "done" means. */
  blurb: string;
  /** Baseline completion the developer knows is already true (0-100).
   *  Used for backend items whose real progress the client shouldn't see
   *  directly — the daily drip climbs toward this ceiling. For frontend /
   *  middleware, this is the honest current state. */
  baseline: number;
  /** Middleware/setup items: who owns it. */
  owner?: Owner;
  /** Middleware/setup items: whether it's finished. */
  done?: boolean;
  /** Mark high-priority items that block other work. */
  priority?: boolean;
  /** What this item is holding up, shown on priority items. */
  blocks?: string;
}

export interface ProjectTemplate {
  /** Stable template id — matches Project.templateKey. */
  key: string;
  /** Human-friendly template name. */
  name: string;
  /** Soft-launch window — seeds Project.launchStart / launchTarget and drives
   *  the backend progress drip. ISO date strings (YYYY-MM-DD). */
  launch: { start: string; target: string };
  /** Backend drip ceiling — never shows more than real backend completion. */
  backendCeiling: number;
  frontend: TrackedItem[];
  backend: TrackedItem[];
  middleware: TrackedItem[];
}
