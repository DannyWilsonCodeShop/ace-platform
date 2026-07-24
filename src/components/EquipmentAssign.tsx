import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { Package, Plus, X, Check } from 'lucide-react';

const client = generateClient<Schema>();

interface EquipmentAssignProps {
  gigId: string;
  assignedIds: string[];
  onUpdate: (ids: string[]) => void;
}

export default function EquipmentAssign({ gigId, assignedIds, onUpdate }: EquipmentAssignProps) {
  const [allEquipment, setAllEquipment] = useState<any[]>([]);
  const [assigned, setAssigned] = useState<any[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await client.models.Equipment.list({ limit: 200 });
        setAllEquipment(data || []);
        setAssigned((data || []).filter(e => assignedIds.includes(e.id)));
      } catch (err) {
        console.error('Failed to load equipment:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [assignedIds]);

  const available = allEquipment.filter(e =>
    e.status === 'available' && !assignedIds.includes(e.id)
  );

  const filtered = available.filter(e =>
    `${e.name} ${e.brand} ${e.model} ${e.category}`.toLowerCase().includes(filter.toLowerCase())
  );

  const assignItem = async (item: any) => {
    const newIds = [...assignedIds, item.id];
    // Update gig
    await client.models.Gig.update({ id: gigId, equipmentIds: newIds });
    // Update equipment status
    await client.models.Equipment.update({ id: item.id, status: 'deployed', currentGigId: gigId });
    setAssigned([...assigned, item]);
    onUpdate(newIds);
  };

  const unassignItem = async (item: any) => {
    const newIds = assignedIds.filter(id => id !== item.id);
    // Update gig
    await client.models.Gig.update({ id: gigId, equipmentIds: newIds });
    // Update equipment status back to available
    await client.models.Equipment.update({ id: item.id, status: 'available', currentGigId: null });
    setAssigned(assigned.filter(a => a.id !== item.id));
    onUpdate(newIds);
  };

  if (loading) return <div className="text-ace-muted text-sm">Loading equipment...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Package size={16} className="text-ace-cyan" /> Equipment
        </h3>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="text-xs text-ace-cyan hover:underline flex items-center gap-1"
        >
          <Plus size={12} /> Assign
        </button>
      </div>

      {/* Assigned list */}
      {assigned.length > 0 ? (
        <div className="space-y-2 mb-3">
          {assigned.map(item => (
            <div key={item.id} className="flex items-center justify-between bg-ace-bg rounded-lg px-3 py-2">
              <div>
                <span className="text-sm font-medium">{item.name}</span>
                <span className="text-xs text-ace-muted ml-2">{item.brand} {item.model}</span>
              </div>
              <button onClick={() => unassignItem(item)} className="text-red-400 hover:text-red-300 p-1">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-ace-muted text-sm mb-3">No equipment assigned.</p>
      )}

      {/* Picker */}
      {showPicker && (
        <div className="border border-ace-border rounded-lg p-3 bg-ace-bg">
          <input
            className="input text-sm mb-3"
            placeholder="Search available equipment..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
          {filtered.length === 0 ? (
            <p className="text-ace-muted text-xs text-center py-2">
              {available.length === 0 ? 'All equipment is deployed.' : 'No matches.'}
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filtered.slice(0, 20).map(item => (
                <button
                  key={item.id}
                  onClick={() => assignItem(item)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 text-left transition-colors"
                >
                  <div>
                    <span className="text-sm">{item.name}</span>
                    <span className="text-xs text-ace-muted ml-2">{item.category}</span>
                  </div>
                  <Check size={14} className="text-ace-cyan" />
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setShowPicker(false)} className="text-xs text-ace-muted hover:text-white mt-2">
            Close
          </button>
        </div>
      )}
    </div>
  );
}
