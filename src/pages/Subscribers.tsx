import { useEffect, useState } from 'react';
import { listSubscribers } from '../utils/api';
import { Mail } from 'lucide-react';

export default function Subscribers() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { listSubscribers().then(setSubs).catch(console.error).finally(() => setLoading(false)); }, []);

  const active = subs.filter((s: any) => s.status === 'active');
  if (loading) return <div className="text-ace-muted">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Subscribers ({active.length})</h1>
      {active.length === 0 ? (
        <div className="card text-center py-12"><Mail size={40} className="text-ace-muted mx-auto mb-4"/><p className="text-ace-muted">No subscribers yet.</p></div>
      ) : (
        <div className="space-y-2">{active.map((s: any) => (<div key={s.id} className="card py-3"><span className="font-medium">{s.name || 'Anonymous'}</span><span className="text-ace-muted ml-3 text-sm">{s.email}</span></div>))}</div>
      )}
    </div>
  );
}
