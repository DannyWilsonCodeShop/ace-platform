import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { ArrowLeft, MapPin, Calendar, Users, CheckSquare, Square, DollarSign, MessageSquare } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const client = generateClient<Schema>();

const statusFlow = ['upcoming', 'confirmed', 'loaded_in', 'live', 'complete', 'paid'];
const statusColors: Record<string, string> = {
  upcoming: 'border-ace-cyan bg-ace-cyan/10 text-ace-cyan',
  confirmed: 'border-green-500 bg-green-500/10 text-green-400',
  loaded_in: 'border-ace-purple bg-ace-purple/10 text-ace-purple',
  live: 'border-ace-magenta bg-ace-magenta/10 text-ace-magenta',
  complete: 'border-ace-purple bg-ace-purple/10 text-ace-purple',
  paid: 'border-green-500 bg-green-500/10 text-green-400',
  cancelled: 'border-red-500 bg-red-500/10 text-red-400',
};

const checklistItems = [
  { key: 'gearPacked', label: 'Gear packed' },
  { key: 'gearLoaded', label: 'Gear loaded in vehicle' },
  { key: 'arrivedAtVenue', label: 'Arrived at venue' },
  { key: 'setupComplete', label: 'Setup complete' },
  { key: 'soundCheck', label: 'Sound check done' },
  { key: 'eventStarted', label: 'Event started' },
  { key: 'eventEnded', label: 'Event ended' },
  { key: 'gearBrokenDown', label: 'Gear broken down' },
  { key: 'gearReturned', label: 'Gear returned' },
];

export default function GigDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [gig, setGig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const { data } = await client.models.Gig.get({ id });
        setGig(data);
        setChecklist(data?.checklist ? JSON.parse(data.checklist) : {});
      } catch (err) {
        console.error('Failed to load gig:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const updateStatus = async (status: string) => {
    if (!id) return;
    await client.models.Gig.update({ id, status: status as any });
    setGig({ ...gig, status });
  };

  const toggleChecklist = async (key: string) => {
    const updated = { ...checklist, [key]: !checklist[key] };
    setChecklist(updated);
    if (id) {
      await client.models.Gig.update({ id, checklist: JSON.stringify(updated) });
    }
  };

  if (loading) return <div className="text-ace-muted">Loading gig...</div>;
  if (!gig) return <div className="text-ace-muted">Gig not found.</div>;

  const eventDates = gig.eventDates ? JSON.parse(gig.eventDates) : [];
  const completedChecks = Object.values(checklist).filter(Boolean).length;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/gigs')} className="text-ace-muted hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{gig.eventType}</h1>
          <p className="text-ace-muted text-sm flex items-center gap-2">
            <MapPin size={14} /> {gig.venueName}
          </p>
        </div>
        <span className={`px-3 py-1.5 rounded-full border text-sm font-medium ${statusColors[gig.status || 'upcoming']}`}>
          {(gig.status || 'upcoming').replace('_', ' ')}
        </span>
      </div>

      {/* Status pipeline */}
      <div className="card mb-6">
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {statusFlow.map((s, i) => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-all ${
                gig.status === s
                  ? statusColors[s]
                  : statusFlow.indexOf(gig.status) > i
                    ? 'border-green-500/30 bg-green-500/5 text-green-400/60'
                    : 'border-ace-border text-ace-muted hover:text-white'
              }`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-6">
          {/* Event details */}
          <div className="card">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Calendar size={18} className="text-ace-cyan" /> Event Details
            </h2>
            <div className="space-y-2 text-sm">
              {eventDates.map((d: any, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-ace-muted">Day {i + 1}:</span>
                  <strong>{d.date && format(parseISO(d.date), 'EEEE, MMM d, yyyy')}</strong>
                  <span className="text-ace-muted">{d.startTime} – {d.endTime}</span>
                </div>
              ))}
              <div className="mt-3 pt-3 border-t border-ace-border">
                <span className="text-ace-muted">Services:</span> <strong>{gig.services?.join(', ')}</strong>
              </div>
              <div><span className="text-ace-muted">Venue:</span> {gig.venueName}, {gig.venueAddress}</div>
              <div><span className="text-ace-muted">Room:</span> {gig.roomName || 'N/A'} | <span className="text-ace-muted">Size:</span> {gig.roomSize}</div>
              <div><span className="text-ace-muted">Indoor/Outdoor:</span> {gig.indoorOutdoor}</div>
            </div>
          </div>

          {/* Day-of Checklist */}
          <div className="card">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <CheckSquare size={18} className="text-ace-cyan" />
              Day-of Checklist
              <span className="text-xs text-ace-muted ml-auto">{completedChecks}/{checklistItems.length}</span>
            </h2>
            <div className="space-y-2">
              {checklistItems.map(item => (
                <button
                  key={item.key}
                  onClick={() => toggleChecklist(item.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm text-left transition-all ${
                    checklist[item.key]
                      ? 'border-green-500/30 bg-green-500/5 text-green-400'
                      : 'border-ace-border hover:border-white/20 text-ace-muted'
                  }`}
                >
                  {checklist[item.key] ? <CheckSquare size={18} /> : <Square size={18} />}
                  {item.label}
                </button>
              ))}
            </div>
            {/* Progress bar */}
            <div className="mt-4 h-2 bg-ace-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-ace-cyan to-ace-purple rounded-full transition-all"
                style={{ width: `${(completedChecks / checklistItems.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Financial */}
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <DollarSign size={16} className="text-green-400" /> Financials
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ace-muted">Quoted</span>
                <strong>${gig.quotedAmount?.toLocaleString() || '—'}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-ace-muted">Deposit</span>
                <span className={gig.depositPaid ? 'text-green-400' : 'text-yellow-400'}>
                  {gig.depositPaid ? '✓ Paid' : 'Pending'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ace-muted">Balance</span>
                <span className={gig.balancePaid ? 'text-green-400' : 'text-ace-muted'}>
                  ${gig.balanceAmount?.toLocaleString() || '—'}
                  {gig.balancePaid && ' ✓'}
                </span>
              </div>
              <button className="btn-primary w-full text-xs mt-3">Create Invoice</button>
            </div>
          </div>

          {/* Crew */}
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Users size={16} className="text-ace-purple" /> Crew
            </h3>
            {gig.assignedCrew?.length > 0 ? (
              <div className="space-y-2 text-sm">
                {gig.assignedCrew.map((id: string) => (
                  <div key={id} className="text-ace-muted">{id}</div>
                ))}
              </div>
            ) : (
              <p className="text-ace-muted text-sm">No crew assigned yet.</p>
            )}
            <button className="btn-secondary w-full text-xs mt-3">Assign Crew</button>
          </div>

          {/* Client notes */}
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <MessageSquare size={16} className="text-ace-cyan" /> Notes
            </h3>
            <p className="text-sm text-ace-muted">{gig.internalNotes || 'No notes yet.'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
