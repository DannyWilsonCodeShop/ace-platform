import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { Users, Plus, X, Check } from 'lucide-react';

const client = generateClient<Schema>();

const roleLabels: Record<string, string> = {
  dj: 'DJ',
  sound_tech: 'Sound Tech',
  crew: 'Crew',
  mc: 'MC',
  musician: 'Musician',
  coordinator: 'Coordinator',
};

interface CrewAssignProps {
  gigId: string;
  assignedIds: string[];
  onUpdate: (ids: string[]) => void;
}

export default function CrewAssign({ gigId, assignedIds, onUpdate }: CrewAssignProps) {
  const [allCrew, setAllCrew] = useState<any[]>([]);
  const [assigned, setAssigned] = useState<any[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await client.models.CrewMember.list({ limit: 100 });
        setAllCrew(data || []);
        setAssigned((data || []).filter(c => assignedIds.includes(c.id)));
      } catch (err) {
        console.error('Failed to load crew:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [assignedIds]);

  const available = allCrew.filter(c => !assignedIds.includes(c.id));

  const assignMember = async (member: any) => {
    const newIds = [...assignedIds, member.id];
    await client.models.Gig.update({ id: gigId, assignedCrew: newIds });
    setAssigned([...assigned, member]);
    onUpdate(newIds);
  };

  const unassignMember = async (member: any) => {
    const newIds = assignedIds.filter(id => id !== member.id);
    await client.models.Gig.update({ id: gigId, assignedCrew: newIds });
    setAssigned(assigned.filter(a => a.id !== member.id));
    onUpdate(newIds);
  };

  if (loading) return <div className="text-ace-muted text-sm">Loading crew...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Users size={16} className="text-ace-purple" /> Crew
        </h3>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="text-xs text-ace-purple hover:underline flex items-center gap-1"
        >
          <Plus size={12} /> Assign
        </button>
      </div>

      {/* Assigned list */}
      {assigned.length > 0 ? (
        <div className="space-y-2 mb-3">
          {assigned.map(member => (
            <div key={member.id} className="flex items-center justify-between bg-ace-bg rounded-lg px-3 py-2">
              <div>
                <span className="text-sm font-medium">{member.name}</span>
                <span className="text-xs text-ace-purple ml-2">{roleLabels[member.role] || member.role}</span>
              </div>
              <button onClick={() => unassignMember(member)} className="text-red-400 hover:text-red-300 p-1">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-ace-muted text-sm mb-3">No crew assigned.</p>
      )}

      {/* Picker */}
      {showPicker && (
        <div className="border border-ace-border rounded-lg p-3 bg-ace-bg">
          {available.length === 0 ? (
            <p className="text-ace-muted text-xs text-center py-2">All crew members assigned.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {available.map(member => (
                <button
                  key={member.id}
                  onClick={() => assignMember(member)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 text-left transition-colors"
                >
                  <div>
                    <span className="text-sm">{member.name}</span>
                    <span className="text-xs text-ace-muted ml-2">{roleLabels[member.role] || member.role}</span>
                  </div>
                  <Check size={14} className="text-ace-purple" />
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
