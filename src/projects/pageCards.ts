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
