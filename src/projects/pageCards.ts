/**
 * Shared row-grouping helper for the row-driven page cards (Decision B).
 *
 * Both dashboards (admin ProjectDetail, customer portal/MyProject) now render
 * page cards by iterating the FETCHED ProjectPage rows grouped by category and
 * ordered by sortOrder (then createdAt), rather than iterating the code
 * template. Each row is enriched with the matching template item (by pageKey)
 * when one exists, so a custom row whose pageKey is not in the template still
 * renders — its blurb is simply blank.
 *
 * Pure function (unit-test-friendly): no React, no I/O.
 */

import type { Category, ProjectTemplate, TrackedItem } from './templates/types';

/** A fetched ProjectPage row (hand-written GraphQL shape from api.ts). */
export interface PageRow {
  id: string;
  projectId?: string;
  pageKey: string;
  label?: string | null;
  category?: Category | string | null;
  href?: string | null;
  sortOrder?: number | null;
  isCustom?: boolean | null;
  createdAt?: string | null;
  [key: string]: any;
}

/** A single card view-model: the fetched row plus its (optional) template item
 *  and the resolved display fields. */
export interface PageCard {
  row: PageRow;
  /** The template item matched by pageKey, or undefined for custom rows. */
  item?: TrackedItem;
  /** Resolved label: row.label || item?.label || row.pageKey. */
  label: string;
  /** Resolved blurb: item?.blurb || ''. */
  blurb: string;
  /** Resolved href: row.href || item?.href. */
  href?: string;
}

/**
 * Group the fetched pages by category and, within each category, order them by
 * (sortOrder ?? 0) ascending then createdAt ascending (stable). Returns the
 * ordered card view-models for the requested category.
 */
export function cardsForCategory(
  pages: PageRow[],
  template: ProjectTemplate,
  category: Category,
): PageCard[] {
  const items: TrackedItem[] = template[category] || [];
  return (pages || [])
    .filter((p) => p.category === category)
    .slice()
    .sort((a, b) => {
      const soA = a.sortOrder ?? 0;
      const soB = b.sortOrder ?? 0;
      if (soA !== soB) return soA - soB;
      const caA = a.createdAt || '';
      const caB = b.createdAt || '';
      if (caA < caB) return -1;
      if (caA > caB) return 1;
      return 0;
    })
    .map((row) => {
      const item = items.find((i) => i.key === row.pageKey);
      return {
        row,
        item,
        label: row.label || item?.label || row.pageKey,
        blurb: item?.blurb || '',
        href: row.href || item?.href,
      };
    });
}

/** A fetched ActionItem row (hand-written GraphQL shape from api.ts). */
export interface ActionItemRow {
  id: string;
  projectId?: string;
  pageKey?: string | null;
  title: string;
  detail?: string | null;
  owner_role?: 'client' | 'together' | 'dev' | string | null;
  priority?: boolean | null;
  blocks?: string | null;
  done?: boolean | null;
  completedAt?: string | null;
  completedBySub?: string | null;
  assigneeSub?: string | null;
  dueDate?: string | null;
  sortOrder?: number | null;
  owner?: string | null;
  createdAt?: string | null;
  [key: string]: any;
}

/** Rank an owner_role for ordering: client -> together -> dev (others last). */
function ownerRoleRank(role: ActionItemRow['owner_role']): number {
  if (role === 'client') return 0;
  if (role === 'together') return 1;
  if (role === 'dev') return 2;
  return 3;
}

/**
 * Open (not-done) action items ordered to mirror the Green-Casting reference:
 * priority items first (priority===true before false), then by owner_role in
 * the order client -> together -> dev, then by sortOrder, then by createdAt.
 * Pure function.
 */
export function openTodos(items: ActionItemRow[]): ActionItemRow[] {
  return (items || [])
    .filter((i) => !i.done)
    .slice()
    .sort((a, b) => {
      const pa = a.priority ? 0 : 1;
      const pb = b.priority ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const ra = ownerRoleRank(a.owner_role);
      const rb = ownerRoleRank(b.owner_role);
      if (ra !== rb) return ra - rb;
      const soA = a.sortOrder ?? 0;
      const soB = b.sortOrder ?? 0;
      if (soA !== soB) return soA - soB;
      const caA = a.createdAt || '';
      const caB = b.createdAt || '';
      if (caA < caB) return -1;
      if (caA > caB) return 1;
      return 0;
    });
}

/**
 * Done action items, most-recently completed first (completedAt descending).
 * Pure function.
 */
export function doneTodos(items: ActionItemRow[]): ActionItemRow[] {
  return (items || [])
    .filter((i) => i.done)
    .slice()
    .sort((a, b) => {
      const caA = a.completedAt || '';
      const caB = b.completedAt || '';
      if (caA < caB) return 1;
      if (caA > caB) return -1;
      return 0;
    });
}
