import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { Calendar, MapPin, Clock, CheckCircle, Circle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const client = generateClient<Schema>();

const statusLabels: Record<string, { label: string; color: string }> = {
  upcoming: { label: 'Upcoming', color: 'text-ace-cyan' },
  confirmed: { label: 'Confirmed', color: 'text-green-400' },
  loaded_in: { label: 'Setup in Progress', color: 'text-ace-purple' },
  live: { label: 'Happening Now', color: 'text-ace-magenta' },
  complete: { label: 'Completed', color: 'text-ace-muted' },
  paid: { label: 'All Done', color: 'text-green-400' },
};

export default function MyEvents() {
  const [gigs, setGigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Customer sees all gigs (filtered by auth rules on backend)
        const { data } = await client.models.Gig.list({ limit: 50 });
        setGigs(data || []);
      } catch (err) {
        console.error('Failed to load events:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="text-ace-muted text-center py-12">Loading your events...</div>;

  if (gigs.length === 0) {
    return (
      <div className="text-center py-16">
        <Calendar size={48} className="text-ace-muted mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Events Yet</h2>
        <p className="text-ace-muted">Once your booking is confirmed, your event details will appear here.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">My Events</h2>
      <div className="space-y-4">
        {gigs.map(gig => {
          const dates = gig.eventDates ? JSON.parse(gig.eventDates) : [];
          const firstDate = dates[0];
          const status = statusLabels[gig.status] || { label: gig.status, color: 'text-ace-muted' };

          return (
            <div key={gig.id} className="card">
              {/* Status badge */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{gig.eventType}</h3>
                <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
              </div>

              {/* Dates */}
              <div className="space-y-2 mb-4">
                {dates.map((d: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <Calendar size={14} className="text-ace-cyan" />
                    <span>{d.date && format(parseISO(d.date), 'EEEE, MMMM d, yyyy')}</span>
                    <Clock size={14} className="text-ace-muted" />
                    <span className="text-ace-muted">{d.startTime} – {d.endTime}</span>
                  </div>
                ))}
              </div>

              {/* Venue */}
              <div className="flex items-center gap-2 text-sm text-ace-muted mb-4">
                <MapPin size={14} />
                <span>{gig.venueName}, {gig.venueAddress}</span>
              </div>

              {/* Services */}
              <div className="flex gap-2 flex-wrap mb-4">
                {gig.services?.map((svc: string) => (
                  <span key={svc} className="text-xs bg-ace-purple/10 text-ace-purple px-2.5 py-1 rounded-full border border-ace-purple/20">
                    {svc}
                  </span>
                ))}
              </div>

              {/* Payment status */}
              <div className="flex items-center gap-4 text-sm pt-3 border-t border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center gap-2">
                  {gig.depositPaid ? <CheckCircle size={14} className="text-green-400" /> : <Circle size={14} className="text-yellow-400" />}
                  <span className={gig.depositPaid ? 'text-green-400' : 'text-yellow-400'}>
                    Deposit {gig.depositPaid ? 'Paid' : 'Pending'}
                  </span>
                </div>
                {gig.quotedAmount && (
                  <span className="text-ace-muted">Total: ${gig.quotedAmount.toLocaleString()}</span>
                )}
              </div>

              {/* Client notes from ACE */}
              {gig.clientNotes && (
                <div className="mt-3 p-3 bg-ace-bg rounded-lg text-sm">
                  <span className="text-ace-muted text-xs uppercase tracking-wide">Note from ACE:</span>
                  <p className="mt-1">{gig.clientNotes}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
