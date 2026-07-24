import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { Users, Plus, Search, Mail, Phone, Star } from 'lucide-react';

const client = generateClient<Schema>();

export default function Clients() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', organization: '' });

  useEffect(() => {
    async function load() {
      try {
        const { data } = await client.models.Client.list({ limit: 100 });
        setClients(data || []);
      } catch (err) {
        console.error('Failed to load clients:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = clients.filter(c =>
    `${c.firstName} ${c.lastName} ${c.email} ${c.organization || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await client.models.Client.create({
        ...form,
        totalGigs: 0,
        totalRevenue: 0,
        isRepeatClient: false,
      });
      if (data) setClients([data, ...clients]);
      setShowAdd(false);
      setForm({ firstName: '', lastName: '', email: '', phone: '', organization: '' });
    } catch (err) {
      console.error('Failed to create client:', err);
    }
  };

  if (loading) return <div className="text-ace-muted">Loading clients...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-2">
          <Plus size={16} /> Add Client
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ace-muted" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search clients..."
          className="input pl-10"
        />
      </div>

      {/* Add Client Modal */}
      {showAdd && (
        <div className="card mb-6 border-ace-purple/30">
          <h3 className="font-semibold mb-4">New Client</h3>
          <form onSubmit={addClient} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="First Name *" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} required />
              <input className="input" placeholder="Last Name *" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Email *" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              <input className="input" placeholder="Phone *" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
            </div>
            <input className="input" placeholder="Organization (optional)" value={form.organization} onChange={e => setForm({ ...form, organization: e.target.value })} />
            <div className="flex gap-3">
              <button type="submit" className="btn-primary text-sm">Save Client</button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Client list */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Users size={40} className="text-ace-muted mx-auto mb-4" />
          <p className="text-ace-muted">{search ? 'No matching clients.' : 'No clients yet.'}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(c => (
            <div key={c.id} className="card hover:border-ace-purple/30 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{c.firstName} {c.lastName}</h3>
                    {c.isRepeatClient && <Star size={14} className="text-yellow-400" />}
                  </div>
                  {c.organization && <p className="text-ace-muted text-xs">{c.organization}</p>}
                  <div className="flex items-center gap-4 mt-1 text-sm text-ace-muted">
                    <span className="flex items-center gap-1"><Mail size={12} />{c.email}</span>
                    <span className="flex items-center gap-1"><Phone size={12} />{c.phone}</span>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-ace-muted">{c.totalGigs || 0} gigs</div>
                  {c.totalRevenue > 0 && <div className="text-green-400 font-semibold">${c.totalRevenue.toLocaleString()}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
