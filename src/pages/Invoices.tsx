import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { Receipt, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const client = generateClient<Schema>();

const statusColors: Record<string, string> = {
  draft: 'bg-white/10 text-ace-muted',
  sent: 'badge-new',
  viewed: 'badge-reviewed',
  partial: 'bg-yellow-500/20 text-yellow-400',
  paid: 'badge-accepted',
  overdue: 'badge-declined',
  cancelled: 'bg-white/10 text-ace-muted',
};

export default function Invoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    async function load() {
      try {
        const { data } = await client.models.Invoice.list({ limit: 100 });
        setInvoices(data || []);
      } catch (err) {
        console.error('Failed to load invoices:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = filter === 'all' ? invoices : invoices.filter(i => i.status === filter);

  // Summary stats
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total || 0), 0);
  const outstanding = invoices.filter(i => ['sent', 'viewed', 'partial', 'overdue'].includes(i.status)).reduce((sum, i) => sum + (i.balanceDue || 0), 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;

  if (loading) return <div className="text-ace-muted">Loading invoices...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Invoices</h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={16} className="text-green-400" />
            <span className="text-xs text-ace-muted">Total Revenue</span>
          </div>
          <p className="text-xl font-bold text-green-400">${totalRevenue.toLocaleString()}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-ace-cyan" />
            <span className="text-xs text-ace-muted">Outstanding</span>
          </div>
          <p className="text-xl font-bold text-ace-cyan">${outstanding.toLocaleString()}</p>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={16} className="text-red-400" />
            <span className="text-xs text-ace-muted">Overdue</span>
          </div>
          <p className="text-xl font-bold text-red-400">{overdueCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', 'draft', 'sent', 'partial', 'paid', 'overdue'].map(s => (
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

      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Receipt size={40} className="text-ace-muted mx-auto mb-4" />
          <p className="text-ace-muted">No invoices yet.</p>
          <p className="text-ace-muted text-sm mt-1">Create one from a confirmed gig.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(inv => (
            <div key={inv.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className={`badge ${statusColors[inv.status || 'draft']}`}>{inv.status}</span>
                    <span className="text-sm font-semibold">${inv.total?.toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-ace-muted mt-1">
                    Due: {inv.dueDate ? format(parseISO(inv.dueDate), 'MMM d, yyyy') : 'Not set'}
                  </div>
                </div>
                <div className="text-right text-sm">
                  {inv.balanceDue > 0 && (
                    <div className="text-yellow-400">Balance: ${inv.balanceDue.toLocaleString()}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
