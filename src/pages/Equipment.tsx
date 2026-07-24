import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { Package, Plus, Search, Filter } from 'lucide-react';

const client = generateClient<Schema>();

const categories = ['all', 'speakers', 'microphones', 'mixers', 'cables', 'stands', 'monitors', 'lighting', 'other'];
const statusColors: Record<string, string> = {
  available: 'bg-green-500/20 text-green-400',
  deployed: 'bg-ace-cyan/20 text-ace-cyan',
  maintenance: 'bg-yellow-500/20 text-yellow-400',
  retired: 'bg-red-500/20 text-red-400',
};

export default function Equipment() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: '', category: 'speakers', brand: '', model: '', serialNumber: '', status: 'available', condition: 'good', notes: ''
  });

  useEffect(() => {
    async function load() {
      try {
        const { data } = await client.models.Equipment.list({ limit: 200 });
        setItems(data || []);
      } catch (err) {
        console.error('Failed to load equipment:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = category === 'all' ? items : items.filter(i => i.category === category);

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await client.models.Equipment.create(form as any);
      if (data) setItems([data, ...items]);
      setShowAdd(false);
      setForm({ name: '', category: 'speakers', brand: '', model: '', serialNumber: '', status: 'available', condition: 'good', notes: '' });
    } catch (err) {
      console.error('Failed to add equipment:', err);
    }
  };

  if (loading) return <div className="text-ace-muted">Loading inventory...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Equipment</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm flex items-center gap-2">
          <Plus size={16} /> Add Item
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {categories.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
              category === c ? 'border-ace-purple text-white bg-ace-purple/10' : 'border-ace-border text-ace-muted hover:text-white'
            }`}
          >
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="card mb-6 border-ace-purple/30">
          <h3 className="font-semibold mb-4">Add Equipment</h3>
          <form onSubmit={addItem} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input className="input" placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {categories.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input className="input" placeholder="Brand" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
              <input className="input" placeholder="Model" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
              <input className="input" placeholder="Serial #" value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select className="input" value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="fair">Fair</option>
                <option value="poor">Poor</option>
              </select>
              <input className="input" placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary text-sm">Add</button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="card py-3 text-center">
          <div className="text-lg font-bold text-green-400">{items.filter(i => i.status === 'available').length}</div>
          <div className="text-xs text-ace-muted">Available</div>
        </div>
        <div className="card py-3 text-center">
          <div className="text-lg font-bold text-ace-cyan">{items.filter(i => i.status === 'deployed').length}</div>
          <div className="text-xs text-ace-muted">Deployed</div>
        </div>
        <div className="card py-3 text-center">
          <div className="text-lg font-bold text-yellow-400">{items.filter(i => i.status === 'maintenance').length}</div>
          <div className="text-xs text-ace-muted">Maintenance</div>
        </div>
        <div className="card py-3 text-center">
          <div className="text-lg font-bold">{items.length}</div>
          <div className="text-xs text-ace-muted">Total</div>
        </div>
      </div>

      {/* Inventory list */}
      {filtered.length === 0 ? (
        <div className="card text-center py-12">
          <Package size={40} className="text-ace-muted mx-auto mb-4" />
          <p className="text-ace-muted">No equipment{category !== 'all' ? ` in ${category}` : ''}.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(item => (
            <div key={item.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{item.name}</h3>
                    <span className={`badge ${statusColors[item.status || 'available']}`}>{item.status}</span>
                  </div>
                  <div className="text-sm text-ace-muted mt-1">
                    {[item.brand, item.model].filter(Boolean).join(' ')}
                    {item.serialNumber && <span className="ml-3 text-xs">S/N: {item.serialNumber}</span>}
                  </div>
                </div>
                <div className="text-xs text-ace-muted capitalize">{item.category}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
