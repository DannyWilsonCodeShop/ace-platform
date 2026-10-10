/**
 * Printable launch-handoff checklist (design §5). Renders the two-moment manual
 * checklist, binding ONLY to the pure handoffState() derivation and the static
 * checklist content. Nothing here executes a hand-off step — the checkboxes are
 * inert reminders Dan ticks by hand. No AWS/DNS/Stripe/SES call is reachable.
 */

import { AlertTriangle, Lock, Printer } from 'lucide-react';
import {
  handoffState,
  type LaunchStatus,
  type PaymentPlanStatus,
} from './handoffState';
import {
  HANDOFF_CHECKLIST,
  ACE_EXECUTES_NONE_NOTE,
  PER_ACCOUNT_BILLING_NOTE,
} from './checklist';

export interface HandoffChecklistViewProps {
  /** Project launch trigger (accepts a Project.status directly). */
  launchStatus?: LaunchStatus | null;
  /** Payment-plan completion trigger (accepts a PaymentPlan.status directly). */
  paymentPlanStatus?: PaymentPlanStatus | null;
  /** Optional project name for the printed heading. */
  projectName?: string;
}

export default function HandoffChecklistView({
  launchStatus,
  paymentPlanStatus,
  projectName,
}: HandoffChecklistViewProps) {
  const state = handoffState(launchStatus, paymentPlanStatus);
  const unlocked: Record<string, boolean> = {
    billing_hosting: state.billingHostingUnlocked,
    code_ownership_account: state.codeOwnershipUnlocked,
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Launch-handoff checklist</h1>
          <p className="text-ace-muted text-sm">
            {projectName ? `${projectName} — ` : ''}manual steps only, performed by hand.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="btn-primary text-sm flex items-center gap-2 flex-shrink-0 print:hidden"
        >
          <Printer size={16} /> Print
        </button>
      </div>

      {/* ACE-executes-none safety note (design §5; AC9/FR4). */}
      <div className="card mb-4 border border-yellow-500/30 bg-yellow-500/5">
        <div className="flex items-start gap-2">
          <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-200">{ACE_EXECUTES_NONE_NOTE}</p>
        </div>
      </div>

      <div className="space-y-6">
        {HANDOFF_CHECKLIST.map((moment) => {
          const isUnlocked = unlocked[moment.moment];
          return (
            <div key={moment.moment} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                <h2 className="text-lg font-semibold">{moment.title}</h2>
                <span
                  className={
                    'badge ' +
                    (isUnlocked
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-white/5 text-ace-muted')
                  }
                >
                  {isUnlocked ? 'Unlocked' : (
                    <span className="inline-flex items-center gap-1">
                      <Lock size={12} /> Locked
                    </span>
                  )}
                </span>
              </div>
              <p className="text-xs text-ace-muted mb-3">{moment.trigger}</p>

              <ul className="space-y-2">
                {moment.steps.map((step) => (
                  <li
                    key={step.id}
                    className="flex items-start gap-2 bg-[#0e0e0e] rounded-lg p-3 border border-[rgba(255,255,255,0.04)]"
                  >
                    {/* Inert checkbox — a print-and-tick reminder, not an action. */}
                    <input type="checkbox" className="mt-0.5" disabled aria-label={step.label} />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm">{step.label}</span>
                      {step.neverAutomated && (
                        <span className="badge bg-red-500/15 text-red-400 ml-2">
                          manual only — never automated by ACE
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Per-account billing note for Dan (answers message #11). */}
      <div className="card mt-4">
        <p className="text-sm text-ace-muted">{PER_ACCOUNT_BILLING_NOTE}</p>
      </div>
    </div>
  );
}
