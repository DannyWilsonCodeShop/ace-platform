import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { UserCog, Plus, Phone, Mail } from 'lucide-react';

const client = generateClient<Schema>();

const roleLabels: Record<string, string> = {
  dj: 'DJ',
  sound_tech: 'Sound Tech',
  crew: 'Crew',
  mc: 'MC / Host',
  musician: 'Musician',
  coordinator: 'Coordinator',
};

export default function Crew() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'crew', hourlyRate: '' });

  useEffect(() => {
    async function load() {
      try {
        const { data } = await client.models.CrewMember.list({ limit: 100 });
        setMembers(data || []);
      } catch (err) {
        console.error('Failed to load crew:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await client.models.CrewMember.create({
        userId: crypto.randomUUID(),
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: form.role as any,
        hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : undefined,
        totalGigs: 0,
        skills: [],
      });
      if (data) setMembers([data, ...members]);
      setShowAdd(false);
      setForm({ name: '', email: '', phone: '', role: 'crew', hourlyRate: '' });
    } catch (err) {
      console.error('Failed to add crew member:', err);
    }
  };

  if (loading) return <div className="text-ace-muted">Loading crew...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Crew</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-2">
          <Plus size={16} /> Add Member
        </button>
      </div>

      {showAdd && (
        <div className="card mb-6 border-ace-purple/30">
          <h3 className="font-semibold mb-4">New Crew Member</h3>
          <form onSubmit={addMember} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Full Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                {Object.entries(roleLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input className="input" placeholder="Email *" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
              <input className="input" placeholder="Phone *" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
              <input className="input" placeholder="Hourly Rate ($)" type="number" value={form.hourlyRate} onChange={e => setForm({ ...form, hourlyRate: e.target.value })} />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary text-sm">Add Member</button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {members.length === 0 ? (
        <div className="card text-center py-12">
          <UserCog size={40} className="text-ace-muted mx-auto mb-4" />
          <p className="text-ace-muted">No crew members yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map(m => (
            <div key={m.id} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{m.name}</h3>
                  <span className="text-xs text-ace-purple font-medium">{roleLabels[m.role] || m.role}</span>
                  <div className="flex items-center gap-3 mt-2 text-sm text-ace-muted">
                    <span className="flex items-center gap-1"><Mail size={12} />{m.email}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-ace-muted mt-1">
                    <Phone size={12} />{m.phone}
                  </div>
                </div>
                <div className="text-right text-xs text-ace-muted">
                  <div>{m.totalGigs || 0} gigs</div>
                  {m.hourlyRate && <div className="text-green-400">${m.hourlyRate}/hr</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
