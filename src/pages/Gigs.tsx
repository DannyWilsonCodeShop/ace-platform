import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listGigs } from '../utils/api';
import { Calendar, MapPin, Clock, ChevronRight } from 'lucide-react';

export default function Gigs() {
  const [gigs, setGigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listGigs().then(setGigs).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-ace-muted">Loading gigs...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Gigs</h1>
      {gigs.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar size={40} className="text-ace-muted mx-auto mb-4" />
          <p className="text-ace-muted">No gigs yet. Accept a quote to create one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {gigs.map((gig: any) => (
            <Link key={gig.id} to={`/gigs/${gig.id}`} className="card block hover:border-ace-purple/30 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{gig.eventType}</h3>
                  <p className="text-sm text-ace-muted flex items-center gap-2"><MapPin size={12}/>{gig.venueName}</p>
                </div>
                <ChevronRight size={18} className="text-ace-muted" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
