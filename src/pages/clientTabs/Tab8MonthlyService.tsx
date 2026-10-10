/**
 * Tab 8 — Monthly Service (FEAT-007, terminal).
 *
 * Renders the fixed monthly-service checklist (src/projects/templates/
 * monthly-checklist.ts) for the variant chosen by Client.hasMonthlyMaintenance,
 * and persists completion per client per month in MonthlyChecklistState
 * (one row per clientId + period 'YYYY-MM'). The row is created on the first
 * tick, and each toggle updates completedItemKeys. A month selector lets the
 * admin review/edit prior months. This is the terminal tab — no advance — but
 * it offers a "mark month complete" affordance.
 *
 * A variant switch only changes WHICH items are shown; the stored keys are
 * preserved untouched, so toggling the client's maintenance flag never erases
 * completions recorded under the other variant.
 */
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAuthSession } from 'aws-amplify/auth';
import { CheckCircle2, Circle } from 'lucide-react';
import type { PanelProps } from './panelContract';
import {
  checklistForVariant,
  variantForClient,
  type ChecklistVariant,
} from '../../projects/templates/monthly-checklist';
import {
  listMonthlyChecklistStatesByClient,
  createMonthlyChecklistState,
  updateMonthlyChecklistState,
} from '../../utils/api';

/** Current month as 'YYYY-MM' (local). */
function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Build a list of 'YYYY-MM' periods: this month + the prior 11. */
function recentPeriods(count = 12): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function labelForPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

export default function Tab8MonthlyService({ client }: PanelProps) {
  const variant: ChecklistVariant = variantForClient(client?.hasMonthlyMaintenance);
  const items = useMemo(() => checklistForVariant(variant), [variant]);

  const [period, setPeriod] = useState<string>(currentPeriod());
  const periods = useMemo(() => recentPeriods(), []);

  // Load all states for this client once; the active one is derived by period.
  const statesQuery = useQuery({
    queryKey: ['tab8-states', client?.id],
    enabled: !!client?.id,
    queryFn: () => listMonthlyChecklistStatesByClient(client.id),
  });
  const undeployed = statesQuery.isError;

  // The row for the selected period (if persisted yet).
  const activeState = useMemo(
    () => (statesQuery.data || []).find((s: any) => s.period === period) || null,
    [statesQuery.data, period],
  );

  // Local optimistic copy of completed keys for the active period.
  const [completed, setCompleted] = useState<string[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCompleted(activeState?.completedItemKeys || []);
  }, [activeState, period]);

  async function authSub(): Promise<string> {
    try {
      const session = await fetchAuthSession();
      return (session.tokens?.accessToken?.payload?.['sub'] as string) || '';
    } catch {
      return '';
    }
  }

  /** Persist a new completedItemKeys set for the active period (create or update). */
  async function persist(nextKeys: string[]) {
    const sub = await authSub();
    if (activeState?.id) {
      await updateMonthlyChecklistState({
        id: activeState.id,
        completedItemKeys: nextKeys,
        variant,
        updatedBySub: sub || null,
      });
    } else {
      await createMonthlyChecklistState({
        clientId: client.id,
        period,
        variant,
        completedItemKeys: nextKeys,
        updatedBySub: sub || null,
      });
    }
    await statesQuery.refetch();
  }

  const toggle = async (key: string) => {
    if (undeployed || !client?.id) return;
    setError(null);
    const next = completed.includes(key)
      ? completed.filter((k) => k !== key)
      : [...completed, key];
    setCompleted(next); // optimistic
    setBusyKey(key);
    try {
      await persist(next);
    } catch (err: any) {
      console.error('Tab8 toggle failed:', err);
      setError('Could not save: ' + (err?.message || 'Unknown error'));
      setCompleted(activeState?.completedItemKeys || []); // rollback
    } finally {
      setBusyKey(null);
    }
  };

  const markMonthComplete = async () => {
    if (undeployed || !client?.id) return;
    setError(null);
    // Mark every SHOWN item for this variant complete, preserving any stored
    // keys from the other variant.
    const shownKeys = items.map((i) => i.key);
    const merged = Array.from(new Set([...completed, ...shownKeys]));
    setCompleted(merged);
    try {
      await persist(merged);
    } catch (err: any) {
      console.error('Tab8 markMonthComplete failed:', err);
      setError('Could not save: ' + (err?.message || 'Unknown error'));
      setCompleted(activeState?.completedItemKeys || []);
    }
  };

  const allShownDone = items.length > 0 && items.every((i) => completed.includes(i.key));

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold mb-1">Monthly Service</h2>
            <p className="text-sm text-ace-muted">
              {variant === 'with_maintenance'
                ? 'Maintenance-plan checklist for this client.'
                : 'Standard (no-maintenance) checklist for this client.'}
            </p>
          </div>
          <div>
            <label className="text-xs text-ace-muted block mb-1">Month</label>
            <select
              className="input text-sm py-1"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
              {periods.map((p) => (
                <option key={p} value={p}>
                  {labelForPeriod(p)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {undeployed && (
          <p className="text-xs text-ace-muted mt-3 italic">
            Checklist tracking is available after deploy.
          </p>
        )}
      </div>

      <div className="card">
        {error && <p className="text-xs text-red-300 mb-2">{error}</p>}
        <ul className="space-y-1">
          {items.map((item) => {
            const done = completed.includes(item.key);
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => toggle(item.key)}
                  disabled={undeployed || busyKey === item.key}
                  className="w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg hover:bg-white/5 disabled:opacity-50"
                >
                  {done ? (
                    <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" />
                  ) : (
                    <Circle size={18} className="text-ace-muted flex-shrink-0" />
                  )}
                  <span className={`text-sm ${done ? 'line-through text-ace-muted' : ''}`}>
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between gap-3">
          <span className="text-xs text-ace-muted">
            {allShownDone ? 'All items complete for this month.' : 'Final stage — no further advance.'}
          </span>
          <button
            onClick={markMonthComplete}
            disabled={undeployed || allShownDone}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {allShownDone ? 'Month complete' : 'Mark month complete'}
          </button>
        </div>
      </div>
    </div>
  );
}
