import { useEffect, useState } from 'react';
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  listCampaignStepsByCampaign,
  createCampaignStep,
  updateCampaignStep,
  listSubscribers,
} from '../utils/api';
import { sendCampaignStep } from '../campaigns/campaigns';
import { Megaphone, Plus, Play, Pause, Archive, Send } from 'lucide-react';

const TRIGGERS: { v: string; label: string }[] = [
  { v: 'quote_declined', label: 'Quote declined' },
  { v: 'project_closed', label: 'Project closed' },
  { v: 'manual', label: 'Manual' },
  { v: 'subscribe', label: 'New subscriber' },
];

const CHANNELS: { v: 'email' | 'sms'; label: string }[] = [
  { v: 'email', label: 'Email' },
  { v: 'sms', label: 'SMS (no transport — TODO)' },
];

const statusBadge: Record<string, string> = {
  draft: 'badge-new',
  active: 'badge-accepted',
  paused: 'badge-quoted',
  archived: 'badge-declined',
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('manual');
  const [creating, setCreating] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([listCampaigns(), listSubscribers()])
      .then(([c, s]) => {
        setCampaigns(c);
        setSubs(s);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createCampaign({ name: name.trim(), trigger, status: 'draft' });
      setName('');
      setTrigger('manual');
      load();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const setStatus = async (c: any, status: string) => {
    try {
      await updateCampaign({ id: c.id, status });
      setCampaigns((prev) => prev.map((x) => (x.id === c.id ? { ...x, status } : x)));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="text-ace-muted">Loading...</div>;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Megaphone size={22} className="text-ace-cyan" /> Campaigns ({campaigns.length})
      </h1>

      {/* Create campaign */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold mb-3">New campaign</h2>
        <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            placeholder="Campaign name"
          />
          <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className="input">
            {TRIGGERS.map((t) => (
              <option key={t.v} value={t.v}>{t.label}</option>
            ))}
          </select>
          <button onClick={handleCreate} disabled={creating || !name.trim()} className="btn-primary text-sm flex items-center gap-2">
            <Plus size={16} /> {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="card text-center py-12">
          <Megaphone size={40} className="text-ace-muted mx-auto mb-4" />
          <p className="text-ace-muted">No campaigns yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} subscribers={subs} onSetStatus={setStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

function CampaignCard({
  campaign,
  subscribers,
  onSetStatus,
}: {
  campaign: any;
  subscribers: any[];
  onSetStatus: (c: any, status: string) => void;
}) {
  const [steps, setSteps] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  // New-step form
  const [order, setOrder] = useState('0');
  const [delayDays, setDelayDays] = useState('0');
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [subject, setSubject] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [addingStep, setAddingStep] = useState(false);

  // Manual send
  const [recipient, setRecipient] = useState('');
  const [sendMsg, setSendMsg] = useState('');

  const loadSteps = () => {
    listCampaignStepsByCampaign(campaign.id)
      .then((s: any[]) => setSteps([...s].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))))
      .catch(console.error)
      .finally(() => setLoaded(true));
  };

  useEffect(() => { loadSteps(); }, [campaign.id]);

  const handleAddStep = async () => {
    setAddingStep(true);
    try {
      await createCampaignStep({
        campaignId: campaign.id,
        order: parseInt(order, 10) || 0,
        delayDays: parseInt(delayDays, 10) || 0,
        channel,
        subject: subject || null,
        bodyTemplate: bodyTemplate || null,
      });
      setOrder(String((parseInt(order, 10) || 0) + 1));
      setDelayDays('0');
      setSubject('');
      setBodyTemplate('');
      loadSteps();
    } catch (err) {
      console.error(err);
    } finally {
      setAddingStep(false);
    }
  };

  const handleSendNext = async () => {
    setSendMsg('');
    const email = recipient.trim();
    if (!email) {
      setSendMsg('Pick or type a recipient first.');
      return;
    }
    const next = steps[0];
    if (!next) {
      setSendMsg('No steps to send.');
      return;
    }
    // Try to resolve a name from the chosen subscriber.
    const sub = subscribers.find((s: any) => s.email === email);
    const result = await sendCampaignStep({
      step: next,
      recipientEmail: email,
      recipientName: sub?.name,
    });
    if (result.skipped) setSendMsg(`Skipped: ${result.reason}`);
    else if (result.success) setSendMsg(`Sent step #${next.order ?? 0} to ${email}.`);
    else setSendMsg('Send failed (see console).');
  };

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{campaign.name}</div>
          <div className="text-xs text-ace-muted">
            Trigger: {TRIGGERS.find((t) => t.v === campaign.trigger)?.label || campaign.trigger || 'manual'}
          </div>
        </div>
        <span className={`badge ${statusBadge[campaign.status] || 'badge-new'}`}>{campaign.status || 'draft'}</span>
      </div>

      {/* Status controls */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button onClick={() => onSetStatus(campaign, 'active')} disabled={campaign.status === 'active'}
          className="text-xs px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 flex items-center gap-1 disabled:opacity-40">
          <Play size={14} /> Activate
        </button>
        <button onClick={() => onSetStatus(campaign, 'paused')} disabled={campaign.status === 'paused'}
          className="text-xs px-3 py-1.5 rounded-lg bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 flex items-center gap-1 disabled:opacity-40">
          <Pause size={14} /> Pause
        </button>
        <button onClick={() => onSetStatus(campaign, 'archived')} disabled={campaign.status === 'archived'}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 flex items-center gap-1 disabled:opacity-40">
          <Archive size={14} /> Archive
        </button>
      </div>

      {/* Steps */}
      <div className="bg-[#0e0e0e] rounded-lg p-3 mb-3">
        <div className="text-xs text-ace-muted mb-2">Steps (ordered)</div>
        {!loaded ? (
          <p className="text-sm text-ace-muted">Loading steps...</p>
        ) : steps.length === 0 ? (
          <p className="text-sm text-ace-muted">No steps yet.</p>
        ) : (
          <div className="space-y-2">
            {steps.map((s) => (
              <div key={s.id} className="flex items-start gap-3 text-sm border-b border-[rgba(255,255,255,0.04)] pb-2 last:border-0 last:pb-0">
                <span className="text-ace-cyan font-semibold">#{s.order ?? 0}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.subject || '(no subject)'}</div>
                  <div className="text-xs text-ace-muted">
                    {s.channel || 'email'} • delay {s.delayDays ?? 0}d
                    {s.channel === 'sms' ? ' • SMS has no transport (TODO)' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add step */}
      <div className="space-y-2 mb-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input value={order} onChange={(e) => setOrder(e.target.value)} className="input" type="number" placeholder="Order" title="Order" />
          <input value={delayDays} onChange={(e) => setDelayDays(e.target.value)} className="input" type="number" placeholder="Delay days" title="Delay days" />
          <select value={channel} onChange={(e) => setChannel(e.target.value as 'email' | 'sms')} className="input col-span-2">
            {CHANNELS.map((ch) => (
              <option key={ch.v} value={ch.v}>{ch.label}</option>
            ))}
          </select>
        </div>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className="input" placeholder="Subject (supports {{name}} {{projectName}})" />
        <textarea value={bodyTemplate} onChange={(e) => setBodyTemplate(e.target.value)} className="input min-h-[70px] resize-y" placeholder="Body template (supports {{name}} {{projectName}})" />
        <button onClick={handleAddStep} disabled={addingStep} className="btn-primary text-sm flex items-center gap-2">
          <Plus size={14} /> {addingStep ? 'Adding...' : 'Add step'}
        </button>
      </div>

      {/* Manual send (stand-in for the deferred drip scheduler — TODO(drip-scheduler)) */}
      <div className="border-t border-[rgba(255,255,255,0.06)] pt-3">
        <div className="text-xs text-ace-muted mb-2">
          Send next step manually (no scheduler in this build — sends step #{steps[0]?.order ?? 0})
        </div>
        <div className="grid sm:grid-cols-[1fr_auto] gap-2">
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="input"
            placeholder="Recipient email"
            list={`subs-${campaign.id}`}
          />
          <datalist id={`subs-${campaign.id}`}>
            {subscribers.map((s: any) => (
              <option key={s.id} value={s.email}>{s.name || s.email}</option>
            ))}
          </datalist>
          <button onClick={handleSendNext} disabled={steps.length === 0}
            className="text-sm px-4 py-2 rounded-lg bg-ace-purple/15 text-ace-purple border border-ace-purple/20 flex items-center gap-2 disabled:opacity-40">
            <Send size={14} /> Send next step
          </button>
        </div>
        {sendMsg && <p className="text-xs text-ace-muted mt-2">{sendMsg}</p>}
      </div>
    </div>
  );
}
