/**
 * Tab 3 — Demo Build (FEAT-007).
 *
 * Builds the cover-page choice board used for the client (the Greenaway-style
 * board): three concept options, each carrying a good/better/best tier + price,
 * stored on the existing Demo model with kind 'CHOICE_BOARD'. Each option's
 * image uploads to project-demos/{projectId}/* via uploadDemoImage. Because a
 * Demo hangs off a Project, we create the Project first (createProjectForClient,
 * idempotent) when none exists, and upsert a single CHOICE_BOARD Demo via a
 * listDemos lookup. Acceptance records the selected option + tier onto the Demo
 * and advances the client to the Agreement stage. An image upload failure is an
 * inline error and the option still saves (without an image).
 */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, ImagePlus, Save } from 'lucide-react';
import type { PanelProps } from './panelContract';
import { STAGE_LABELS } from './stageOrder';
import {
  listProjectsByClient,
  listDemos,
  createDemo,
  updateDemo,
} from '../../utils/api';
import { createProjectForClient } from '../../projects/promoteQuote';
import { uploadDemoImage } from '../../projects/demos';

const TIERS = ['good', 'better', 'best'] as const;
type Tier = (typeof TIERS)[number];

interface Option {
  name: string;
  imageKey: string;
  tier: Tier;
  price: string;
}

function blankOptions(): Option[] {
  return [
    { name: 'Option 1', imageKey: '', tier: 'good', price: '' },
    { name: 'Option 2', imageKey: '', tier: 'better', price: '' },
    { name: 'Option 3', imageKey: '', tier: 'best', price: '' },
  ];
}

/** Normalize Demo.options (JSON) into the editable three-option shape. */
function fromDemo(raw: any): Option[] {
  let arr = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return blankOptions();
    }
  }
  if (!Array.isArray(arr) || arr.length === 0) return blankOptions();
  const mapped: Option[] = arr.slice(0, 3).map((o: any, i: number) => ({
    name: String(o?.name ?? `Option ${i + 1}`),
    imageKey: String(o?.imageKey ?? ''),
    tier: (TIERS as readonly string[]).includes(o?.tier) ? (o.tier as Tier) : TIERS[i] ?? 'good',
    price: o?.price != null ? String(o.price) : '',
  }));
  while (mapped.length < 3) {
    const i = mapped.length;
    mapped.push({ name: `Option ${i + 1}`, imageKey: '', tier: TIERS[i] ?? 'good', price: '' });
  }
  return mapped;
}

export default function Tab3DemoBuild({ client, quote, advanceStage }: PanelProps) {
  const [options, setOptions] = useState<Option[]>(blankOptions());
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [demoId, setDemoId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Load the client's existing Project + CHOICE_BOARD demo, if any.
  const boardQuery = useQuery({
    queryKey: ['tab3-board', client?.id],
    enabled: !!client?.id,
    queryFn: async () => {
      const projects = await listProjectsByClient(client.id);
      const project = (projects || [])[0] || null;
      if (!project) return { project: null, demo: null };
      const demos = await listDemos(project.id);
      const board = (demos || []).find((d: any) => d.kind === 'CHOICE_BOARD') || null;
      return { project, demo: board };
    },
  });

  useEffect(() => {
    const data = boardQuery.data;
    if (!data) return;
    setProjectId(data.project?.id ?? null);
    if (data.demo) {
      setDemoId(data.demo.id);
      setOptions(fromDemo(data.demo.options));
      // selectedOption is persisted as the chosen option name.
      if (data.demo.selectedOption) {
        const idx = fromDemo(data.demo.options).findIndex(
          (o) => o.name === data.demo.selectedOption,
        );
        if (idx >= 0) setSelectedIndex(idx);
      }
    }
  }, [boardQuery.data]);

  const setOpt = (i: number, patch: Partial<Option>) => {
    setOptions((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setSaved(false);
  };

  /** Ensure a Project exists (create via the idempotent FEAT-003 helper). */
  async function ensureProject(): Promise<string | null> {
    if (projectId) return projectId;
    const projects = await listProjectsByClient(client.id);
    if (projects && projects.length > 0) {
      setProjectId(projects[0].id);
      return projects[0].id;
    }
    if (!quote?.id) {
      setError('No linked quote — cannot create the project the choice board needs. Link a quote in Tab 1 first.');
      return null;
    }
    const { projectId: created } = await createProjectForClient(client, quote);
    setProjectId(created);
    return created;
  }

  const handleUpload = async (i: number, file: File) => {
    setUploadError(null);
    const pid = await ensureProject();
    if (!pid) return;
    setUploadingIdx(i);
    try {
      const key = await uploadDemoImage(pid, file, options[i].name || `option-${i + 1}`);
      setOpt(i, { imageKey: key });
    } catch (err: any) {
      console.error('Tab3 image upload failed:', err);
      // Inline error; the option is still saved without an image.
      setUploadError(
        `Could not upload the image for "${options[i].name || `Option ${i + 1}`}": ` +
          (err?.message || 'Unknown error') +
          '. The option will save without an image.',
      );
    } finally {
      setUploadingIdx(null);
    }
  };

  /** Upsert the CHOICE_BOARD Demo (create first time, update after). */
  async function persistBoard(selectedName?: string, selectedTier?: Tier) {
    const pid = await ensureProject();
    if (!pid) return null;
    const optionsPayload = options.map((o) => ({
      name: o.name.trim() || 'Option',
      imageKey: o.imageKey || null,
      tier: o.tier,
      price: o.price.trim() === '' ? null : Number(o.price),
    }));
    if (demoId) {
      const updated = await updateDemo({
        id: demoId,
        options: optionsPayload,
        ...(selectedName ? { selectedOption: selectedName } : {}),
      });
      return updated;
    }
    const created = await createDemo({
      projectId: pid,
      title: 'Concept Choice Board',
      kind: 'CHOICE_BOARD',
      status: selectedName ? 'accepted' : 'draft',
      options: optionsPayload,
      ...(selectedName ? { selectedOption: selectedName } : {}),
    });
    if (created?.id) setDemoId(created.id);
    void selectedTier; // tier rides on the selected option row itself.
    return created;
  }

  const handleSave = async () => {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await persistBoard();
      setSaved(true);
      await boardQuery.refetch();
    } catch (err: any) {
      console.error('Tab3 save failed:', err);
      setError('Could not save the choice board: ' + (err?.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async () => {
    setError(null);
    if (selectedIndex == null) {
      setError('Select one of the three options before accepting.');
      return;
    }
    const chosen = options[selectedIndex];
    setAccepting(true);
    try {
      await persistBoard(chosen.name.trim() || `Option ${selectedIndex + 1}`, chosen.tier);
      await advanceStage('agreement');
      await boardQuery.refetch();
    } catch (err: any) {
      console.error('Tab3 accept failed:', err);
      setError('Could not accept the option: ' + (err?.message || 'Unknown error'));
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold mb-1">Demo Build — Choice Board</h2>
        <p className="text-sm text-ace-muted">
          Build the three concept options and their good / better / best price
          tiers. Upload a cover image for each, then accept the client's choice.
        </p>
        {uploadError && <p className="text-xs text-red-300 mt-3">{uploadError}</p>}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {options.map((o, i) => {
          const isSelected = selectedIndex === i;
          return (
            <div
              key={i}
              className={`card space-y-3 border ${
                isSelected ? 'border-ace-cyan/60' : 'border-[rgba(255,255,255,0.06)]'
              }`}
            >
              <input
                className="input text-sm py-1 w-full font-medium"
                value={o.name}
                onChange={(e) => setOpt(i, { name: e.target.value })}
                placeholder={`Option ${i + 1} name`}
              />

              {/* Image */}
              <div className="rounded-lg bg-[#0e0e0e] border border-[rgba(255,255,255,0.06)] aspect-video flex items-center justify-center text-xs text-ace-muted overflow-hidden">
                {o.imageKey ? (
                  <span className="px-2 text-center break-all">{o.imageKey}</span>
                ) : (
                  <span>No image</span>
                )}
              </div>
              <label className="text-xs px-2 py-1 rounded-lg bg-white/5 text-white border border-[rgba(255,255,255,0.06)] flex items-center gap-1 cursor-pointer w-fit">
                <ImagePlus size={12} />
                {uploadingIdx === i ? 'Uploading…' : 'Upload image'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingIdx === i}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(i, f);
                    e.target.value = '';
                  }}
                />
              </label>

              {/* Tier + price */}
              <div className="flex items-center gap-2">
                <select
                  className="input text-xs py-1"
                  value={o.tier}
                  onChange={(e) => setOpt(i, { tier: e.target.value as Tier })}
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t[0].toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
                <input
                  className="input text-xs py-1 flex-1"
                  placeholder="Price"
                  value={o.price}
                  onChange={(e) => setOpt(i, { price: e.target.value })}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedIndex(i);
                  setError(null);
                }}
                className={`w-full text-xs px-2 py-1.5 rounded-lg flex items-center justify-center gap-1 border ${
                  isSelected
                    ? 'bg-ace-cyan/20 text-ace-cyan border-ace-cyan/30'
                    : 'bg-white/5 text-white border-[rgba(255,255,255,0.06)]'
                }`}
              >
                <CheckCircle2 size={12} />
                {isSelected ? 'Selected' : 'Select this option'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="card">
        {error && <p className="text-xs text-red-300 mb-2">{error}</p>}
        {saved && !error && <p className="text-xs text-green-400 mb-2">Saved.</p>}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={handleSave}
            disabled={saving || !client?.id}
            className="btn-secondary text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save choice board'}
          </button>
          <button
            onClick={handleAccept}
            disabled={accepting || !client?.id}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {accepting ? 'Accepting…' : `Accept & advance to ${STAGE_LABELS.agreement}`}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
