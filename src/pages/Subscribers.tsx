import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { Mail, UserPlus, Download } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const client = generateClient<Schema>();

export default function Subscribers() {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await client.models.Subscriber.list({ limit: 500 });
        setSubscribers(data || []);
      } catch (err) {
        console.error('Failed to load subscribers:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const active = subscribers.filter(s => s.status === 'active');

  const exportCSV = () => {
    const csv = ['Name,Email,Source,Subscribed At', ...active.map(s =>
      `${s.name || ''},${s.email},${s.source || ''},${s.createdAt || ''}`
    )].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ace-subscribers-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (loading) return <div className="text-ace-muted">Loading subscribers...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Subscribers</h1>
        <div className="flex gap-3">
          <button onClick={exportCSV} className="btn-secondary text-sm flex items-center gap-2">
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className="card mb-6">
        <div className="flex items-center gap-3">
          <UserPlus size={18} className="text-ace-cyan" />
          <span className="text-lg font-bold">{active.length}</span>
          <span className="text-ace-muted text-sm">active subscribers</span>
        </div>
      </div>

      {active.length === 0 ? (
        <div className="card text-center py-12">
          <Mail size={40} className="text-ace-muted mx-auto mb-4" />
          <p className="text-ace-muted">No subscribers yet.</p>
          <p className="text-ace-muted text-sm mt-1">They'll appear here when people sign up from the website.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {active.map(sub => (
            <div key={sub.id} className="card py-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{sub.name || 'Anonymous'}</span>
                  <span className="text-ace-muted ml-3 text-sm">{sub.email}</span>
                </div>
                <div className="text-xs text-ace-muted">
                  {sub.createdAt && format(parseISO(sub.createdAt), 'MMM d, yyyy')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
