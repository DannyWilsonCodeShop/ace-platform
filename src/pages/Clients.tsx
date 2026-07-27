import { useEffect, useState } from 'react';
import { listClients, createClient } from '../utils/api';
import { Users, Plus, Search, Mail, Phone } from 'lucide-react';

export default function Clients() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', organization: '' });

  useEffect(() => { listClients().then(setClients).catch(console.error).finally(() => setLoading(false)); }, []);

  const filtered = clients.filter((c: any) => `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = await createClient({ ...form, totalGigs: 0, totalRevenue: 0, isRepeatClient: false });
    if (data) setClients([data, ...clients]);
    setShowAdd(false);
    setForm({ firstName: '', lastName: '', email: '', phone: '', organization: '' });
  };

  if (loading) return <div className="text-ace-muted">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-2"><Plus size={16}/> Add</button>
      </div>
      <div className="relative mb-6"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ace-muted"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="input pl-10"/></div>
      {showAdd && (
        <form onSubmit={handleAdd} className="card mb-6 space-y-3">
          <div className="grid grid-cols-2 gap-3"><input className="input" placeholder="First Name" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} required/><input className="input" placeholder="Last Name" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} required/></div>
          <div className="grid grid-cols-2 gap-3"><input className="input" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required/><input className="input" placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} required/></div>
          <div className="flex gap-3"><button type="submit" className="btn-primary text-sm">Save</button><button type="button" onClick={() => setShowAdd(false)} className="btn-secondary text-sm">Cancel</button></div>
        </form>
      )}
      {filtered.length === 0 ? <div className="card text-center py-12"><Users size={40} className="text-ace-muted mx-auto mb-4"/><p className="text-ace-muted">No clients.</p></div> : (
        <div className="space-y-3">{filtered.map((c: any) => (<div key={c.id} className="card"><h3 className="font-semibold">{c.firstName} {c.lastName}</h3><div className="flex gap-4 text-sm text-ace-muted mt-1"><span className="flex items-center gap-1"><Mail size={12}/>{c.email}</span><span className="flex items-center gap-1"><Phone size={12}/>{c.phone}</span></div></div>))}</div>
      )}
    </div>
  );
}
