import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listQuotes } from '../utils/api';
import { FileText, Clock, ChevronRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const statusBadge: Record<string, string> = {
  new: 'badge badge-new',
  reviewed: 'badge badge-reviewed',
  quoted: 'badge badge-quoted',
  accepted: 'badge badge-accepted',
  declined: 'badge badge-declined',
  expired: 'badge badge-declined',
};

export default function Quotes() {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function load() {
      try {
        const data = await listQuotes();
        setQuotes(data);
      } catch (err) {
        console.error('Failed to load quotes:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = filter === 'all' ? quotes : quotes.filter(q => q.status === filter);

  if (loading) return <div className="text-ace-muted">Loading quotes...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Quotes</h1>
        <div className="flex gap-2">
          {['all', 'new', 'reviewed', 'quoted', 'accepted'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filter === s ? 'border-ace-purple text-white bg-ace-purple/10' : 'border-ace-border text-ace-muted hover:text-white'
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <FileText size={40} className="text-ace-muted mx-auto mb-4" />
          <p className="text-ace-muted">No quotes yet.</p>
          <p className="text-ace-muted text-sm mt-1">They'll appear here when customers submit from the website.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(quote => (
            <Link key={quote.id} to={`/quotes/${quote.id}`} className="card block hover:border-ace-purple/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold truncate">{quote.firstName} {quote.lastName}</h3>
                    <span className={statusBadge[quote.status || 'new']}>{quote.status || 'new'}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-ace-muted">
                    <span>{quote.serviceType === 'digital' ? 'Digital Project' : quote.eventType || 'Event'}</span>
                    {quote.createdAt && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} className="text-ace-muted" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
