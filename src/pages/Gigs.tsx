import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { Calendar, List, MapPin, Clock, ChevronRight } from 'lucide-react';
import { format, parseISO, isAfter } from 'date-fns';

const client = generateClient<Schema>();

const statusColors: Record<string, string> = {
  upcoming: 'badge-new',
  confirmed: 'badge-accepted',
  loaded_in: 'badge-reviewed',
  live: 'bg-ace-magenta/20 text-ace-magenta',
  complete: 'badge-reviewed',
  paid: 'badge-accepted',
  cancelled: 'badge-declined',
};

export default function Gigs() {
  const [gigs, setGigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function load() {
      try {
        const { data } = await client.models.Gig.list({ limit: 100 });
        setGigs(data || []);
      } catch (err) {
        console.error('Failed to load gigs:', err);
      } finally {
        setLoading(false);
      }
    }
    load();

    const sub = client.models.Gig.observeQuery().subscribe({
      next: ({ items }) => setGigs(items),
    });
    return () => sub.unsubscribe();
  }, []);

  const filtered = filter === 'all' ? gigs : gigs.filter(g => g.status === filter);

  // Sort by next event date
  const sorted = [...filtered].sort((a, b) => {
    const aDate = a.eventDates ? JSON.parse(a.eventDates)?.[0]?.date : '';
    const bDate = b.eventDates ? JSON.parse(b.eventDates)?.[0]?.date : '';
    return aDate.localeCompare(bDate);
  });

  if (loading) return <div className="text-ace-muted">Loading gigs...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Gigs</h1>
        <div className="flex items-center gap-3">
          <div className="flex bg-ace-card rounded-lg border border-ace-border overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`p-2 ${view === 'list' ? 'bg-ace-purple/15 text-white' : 'text-ace-muted'}`}
            >
              <List size={18} />
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`p-2 ${view === 'calendar' ? 'bg-ace-purple/15 text-white' : 'text-ace-muted'}`}
            >
              <Calendar size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'upcoming', 'confirmed', 'live', 'complete', 'paid'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === s ? 'border-ace-purple text-white bg-ace-purple/10' : 'border-ace-border text-ace-muted hover:text-white'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar size={40} className="text-ace-muted mx-auto mb-4" />
          <p className="text-ace-muted">No gigs yet.</p>
          <p className="text-ace-muted text-sm mt-1">Accept a quote to create your first gig.</p>
        </div>
      ) : view === 'list' ? (
        <div className="space-y-3">
          {sorted.map(gig => {
            const dates = gig.eventDates ? JSON.parse(gig.eventDates) : [];
            const firstDate = dates[0]?.date;
            return (
              <Link key={gig.id} to={`/gigs/${gig.id}`} className="card block hover:border-ace-purple/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold truncate">{gig.eventType}</h3>
                      <span className={`badge ${statusColors[gig.status || 'upcoming']}`}>
                        {(gig.status || 'upcoming').replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-ace-muted">
                      {firstDate && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {format(parseISO(firstDate), 'MMM d, yyyy')}
                          {dates.length > 1 && ` (+${dates.length - 1} days)`}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {gig.venueName}
                      </span>
                    </div>
                    <div className="text-xs text-ace-muted mt-1">
                      {gig.services?.join(', ')}
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    {gig.quotedAmount && (
                      <div className="text-sm font-semibold text-green-400">${gig.quotedAmount.toLocaleString()}</div>
                    )}
                    <ChevronRight size={18} className="text-ace-muted ml-auto mt-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <p className="text-ace-muted text-center py-8">Calendar view coming soon — use list view for now.</p>
        </div>
      )}
    </div>
  );
}
