import { useEffect, useState } from 'react';
import { listCrew, createCrewMember } from '../utils/api';
import { UserCog, Plus } from 'lucide-react';

export default function Crew() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { listCrew().then(setMembers).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="text-ace-muted">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Crew</h1>
      {members.length === 0 ? (
        <div className="card text-center py-12"><UserCog size={40} className="text-ace-muted mx-auto mb-4"/><p className="text-ace-muted">No crew members yet.</p></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">{members.map((m: any) => (<div key={m.id} className="card"><h3 className="font-semibold">{m.name}</h3><p className="text-xs text-ace-purple">{m.role}</p><p className="text-sm text-ace-muted mt-1">{m.email}</p></div>))}</div>
      )}
    </div>
  );
}
