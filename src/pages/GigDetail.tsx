import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function GigDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/gigs')} className="text-ace-muted hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold">Gig Detail</h1>
      </div>
      <div className="card">
        <p className="text-ace-muted">Gig detail view with checklist, crew assignment, and timeline coming next.</p>
        <p className="text-xs text-ace-muted mt-2">ID: {id}</p>
      </div>
    </div>
  );
}
