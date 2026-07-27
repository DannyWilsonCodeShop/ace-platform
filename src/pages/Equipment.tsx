import { useEffect, useState } from 'react';
import { listEquipment, createEquipment } from '../utils/api';
import { Package, Plus } from 'lucide-react';

export default function Equipment() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { listEquipment().then(setItems).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="text-ace-muted">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Equipment</h1>
      {items.length === 0 ? (
        <div className="card text-center py-12"><Package size={40} className="text-ace-muted mx-auto mb-4"/><p className="text-ace-muted">No equipment added yet.</p></div>
      ) : (
        <div className="space-y-3">{items.map((item: any) => (<div key={item.id} className="card"><h3 className="font-semibold">{item.name}</h3><p className="text-sm text-ace-muted">{item.brand} {item.model} — {item.status}</p></div>))}</div>
      )}
    </div>
  );
}
