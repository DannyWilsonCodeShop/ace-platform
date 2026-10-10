/**
 * Tab 2 — Demo Details (FEAT-007).
 *
 * A phone-call form the admin fills in while on the line with the client,
 * capturing the app details, a simple key/value requirements list, and the
 * expected demo delivery date. All three persist onto the Client
 * (demoAppDetails / demoRequirements / expectedDemoDate) via updateClient on
 * explicit Save. The date is validated as parseable if set (a warning, never a
 * hard block). Bottom action advances to Demo Build.
 *
 * TODO(demo-requirements-template): requirements is a free-form key/value list
 * for now; a structured template (platform, auth, integrations, etc.) is
 * deferred.
 */
import { useState } from 'react';
import { ArrowRight, Plus, Save, Trash2 } from 'lucide-react';
import type { PanelProps } from './panelContract';
import { STAGE_LABELS } from './stageOrder';
import { updateClient } from '../../utils/api';

type KV = { key: string; value: string };

/** Parse Client.demoRequirements (stored JSON) into an editable KV list. */
function toKVList(raw: any): KV[] {
  if (!raw) return [];
  let obj = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((e) => e && typeof e === 'object')
      .map((e: any) => ({ key: String(e.key ?? ''), value: String(e.value ?? '') }));
  }
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).map(([key, value]) => ({ key, value: String(value) }));
  }
  return [];
}

export default function Tab2DemoDetails({ client, advanceStage }: PanelProps) {
  const [appDetails, setAppDetails] = useState<string>(client?.demoAppDetails || '');
  const [expectedDate, setExpectedDate] = useState<string>(client?.expectedDemoDate || '');
  const [requirements, setRequirements] = useState<KV[]>(() => toKVList(client?.demoRequirements));

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateWarning, setDateWarning] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const setReq = (i: number, patch: Partial<KV>) =>
    setRequirements((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addReq = () => setRequirements((rows) => [...rows, { key: '', value: '' }]);
  const removeReq = (i: number) => setRequirements((rows) => rows.filter((_, j) => j !== i));

  const validateDate = (): boolean => {
    if (!expectedDate.trim()) {
      setDateWarning(null);
      return true;
    }
    const parsed = new Date(expectedDate);
    if (Number.isNaN(parsed.getTime())) {
      setDateWarning('Expected demo date is not a valid date — it will be saved as entered.');
      return true; // warn, don't block
    }
    setDateWarning(null);
    return true;
  };

  const handleSave = async () => {
    if (!client?.id) return;
    setError(null);
    setSaved(false);
    validateDate();
    // Keep only rows that have a key; serialize to a key/value object.
    const cleaned = requirements.filter((r) => r.key.trim());
    const reqObject = cleaned.reduce<Record<string, string>>((acc, r) => {
      acc[r.key.trim()] = r.value;
      return acc;
    }, {});
    setSaving(true);
    try {
      await updateClient({
        id: client.id,
        demoAppDetails: appDetails.trim() || null,
        demoRequirements: cleaned.length ? reqObject : null,
        expectedDemoDate: expectedDate.trim() || null,
      });
      setSaved(true);
    } catch (err: any) {
      console.error('Tab2 save failed:', err);
      setError('Could not save demo details: ' + (err?.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      await advanceStage('demo_build');
    } finally {
      setAdvancing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold mb-1">Demo Details</h2>
        <p className="text-sm text-ace-muted mb-4">
          Capture the client's app details and the expected demo delivery date
          while you're on the call.
        </p>

        <label className="text-xs text-ace-muted block mb-1">App details</label>
        <textarea
          value={appDetails}
          onChange={(e) => {
            setAppDetails(e.target.value);
            setSaved(false);
          }}
          onBlur={() => setSaved(false)}
          rows={5}
          placeholder="What are they building? Core idea, audience, must-have screens, references…"
          className="input w-full text-sm"
        />

        <div className="mt-4">
          <label className="text-xs text-ace-muted block mb-1">Expected demo delivery date</label>
          <input
            type="date"
            value={expectedDate}
            onChange={(e) => {
              setExpectedDate(e.target.value);
              setSaved(false);
            }}
            onBlur={validateDate}
            className="input text-sm w-48"
          />
          {dateWarning && <p className="text-xs text-yellow-400 mt-1">{dateWarning}</p>}
        </div>
      </div>

      {/* Requirements key/value list */}
      <div className="card">
        <h3 className="text-sm font-semibold mb-2">Requirements</h3>
        <p className="text-xs text-ace-muted mb-3">
          A simple key/value list (e.g. Platform → iOS + Android, Auth → Google).
        </p>
        <div className="space-y-2">
          {requirements.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className="input text-xs py-1 w-40"
                placeholder="Key"
                value={r.key}
                onChange={(e) => {
                  setReq(i, { key: e.target.value });
                  setSaved(false);
                }}
              />
              <input
                className="input text-xs py-1 flex-1"
                placeholder="Value"
                value={r.value}
                onChange={(e) => {
                  setReq(i, { value: e.target.value });
                  setSaved(false);
                }}
              />
              <button
                type="button"
                onClick={() => {
                  removeReq(i);
                  setSaved(false);
                }}
                className="text-ace-muted hover:text-red-400"
                title="Remove"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addReq}
          className="mt-2 text-xs px-2 py-1 rounded-lg bg-white/5 text-white border border-[rgba(255,255,255,0.06)] flex items-center gap-1"
        >
          <Plus size={12} /> Add requirement
        </button>
      </div>

      {/* Save + status */}
      <div className="card">
        {error && <p className="text-xs text-red-300 mb-2">{error}</p>}
        {saved && !error && <p className="text-xs text-green-400 mb-2">Saved.</p>}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !client?.id}
            className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save demo details'}
          </button>
        </div>
      </div>

      {/* Bottom action */}
      <div className="flex justify-end">
        <button
          onClick={handleAdvance}
          disabled={advancing}
          className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
        >
          Advance to {STAGE_LABELS.demo_build}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
