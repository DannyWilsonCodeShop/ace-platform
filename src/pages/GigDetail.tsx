import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getGig, updateGig } from '../utils/api';
import { ArrowLeft, CheckSquare, Square } from 'lucide-react';

const checklistItems = [
  { key: 'gearPacked', label: 'Gear packed' },
  { key: 'gearLoaded', label: 'Gear loaded' },
  { key: 'arrivedAtVenue', label: 'Arrived at venue' },
  { key: 'setupComplete', label: 'Setup complete' },
  { key: 'soundCheck', label: 'Sound check' },
  { key: 'eventStarted', label: 'Event started' },
  { key: 'eventEnded', label: 'Event ended' },
  { key: 'gearBrokenDown', label: 'Gear broken down' },
  { key: 'gearReturned', label: 'Gear returned' },
];

export default function GigDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [gig, setGig] = useState<any>(null);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getGig(id).then(data => {
      setGig(data);
      try { setChecklist(data?.checklist ? JSON.parse(data.checklist) : {}); } catch { setChecklist({}); }
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const toggleCheck = async (key: string) => {
    const updated = { ...checklist, [key]: !checklist[key] };
    setChecklist(updated);
    if (id) await updateGig({ id, checklist: JSON.stringify(updated) });
  };

  if (loading) return <div className="text-ace-muted">Loading...</div>;
  if (!gig) return <div className="text-ace-muted">Gig not found.</div>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/gigs')} className="text-ace-muted hover:text-white"><ArrowLeft size={20}/></button>
        <h1 className="text-2xl font-bold">{gig.eventType}</h1>
      </div>
      <div className="card mb-6">
        <p className="text-sm text-ace-muted">{gig.venueName} — {gig.venueAddress}</p>
        <p className="text-sm mt-2">Services: {Array.isArray(gig.services) ? gig.services.join(', ') : ''}</p>
      </div>
      <div className="card">
        <h2 className="font-semibold mb-4">Day-of Checklist</h2>
        <div className="space-y-2">
          {checklistItems.map(item => (
            <button key={item.key} onClick={() => toggleCheck(item.key)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm text-left transition-all ${checklist[item.key] ? 'border-green-500/30 bg-green-500/5 text-green-400' : 'border-[rgba(255,255,255,0.06)] text-ace-muted'}`}>
              {checklist[item.key] ? <CheckSquare size={18}/> : <Square size={18}/>}
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
