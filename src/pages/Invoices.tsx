import { useEffect, useState } from 'react';
import { listInvoices } from '../utils/api';
import { Receipt } from 'lucide-react';

export default function Invoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { listInvoices().then(setInvoices).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="text-ace-muted">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Invoices</h1>
      {invoices.length === 0 ? (
        <div className="card text-center py-12"><Receipt size={40} className="text-ace-muted mx-auto mb-4"/><p className="text-ace-muted">No invoices yet.</p></div>
      ) : (
        <div className="space-y-3">{invoices.map((inv: any) => (<div key={inv.id} className="card"><div className="flex justify-between"><span className="font-semibold">${inv.total}</span><span className="text-sm text-ace-muted">{inv.status}</span></div></div>))}</div>
      )}
    </div>
  );
}
