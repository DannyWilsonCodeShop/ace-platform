/**
 * Customer invoices. Scoped to the signed-in customer: resolve THEIR Client by
 * matching the Cognito identity against Client.cognitoUserId (same mechanism as
 * MyProject), then list invoices filtered to that clientId (and any of their
 * projects). Payment collection via Stripe is a separate // TODO webhook seam;
 * here we only display the invoice + an optional payment link if one exists.
 */

import { useEffect, useState } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { format, parseISO } from 'date-fns';
import { Receipt } from 'lucide-react';
import { listClients, listProjects, listInvoices } from '../../utils/api';

const STATUS_TONE: Record<string, string> = {
  draft: 'bg-white/5 text-ace-muted',
  sent: 'bg-yellow-500/15 text-yellow-400',
  paid: 'bg-green-500/15 text-green-400',
  overdue: 'bg-red-500/15 text-red-400',
};

export default function MyInvoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const session = await fetchAuthSession();
        const payload = session.tokens?.accessToken?.payload || {};
        const idPayload = session.tokens?.idToken?.payload || {};
        const sub = (payload['sub'] as string) || '';
        const username = (payload['username'] as string) || '';
        const email = ((idPayload['email'] as string) || '').toLowerCase();
        const identities = [sub, username, email].filter(Boolean);

        const clients = await listClients();
        const client = (clients || []).find((c: any) => {
          const cuid = (c.cognitoUserId || '').toLowerCase();
          return (cuid && identities.includes(cuid)) || (c.email || '').toLowerCase() === email;
        });
        if (!client) {
          setError('No invoices found for your account yet.');
          return;
        }

        const projects = await listProjects();
        const myProjectIds = new Set(
          (projects || []).filter((p: any) => p.clientId === client.id).map((p: any) => p.id),
        );

        const all = await listInvoices();
        setInvoices(
          (all || []).filter(
            (inv: any) => inv.clientId === client.id || myProjectIds.has(inv.projectId),
          ),
        );
      } catch (err) {
        console.error(err);
        setError('Something went wrong loading your invoices.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-ace-muted">Loading invoices...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Invoices &amp; Payments</h1>
      {error ? (
        <div className="card text-ace-muted">{error}</div>
      ) : invoices.length === 0 ? (
        <div className="card text-center py-12">
          <Receipt size={40} className="text-ace-muted mx-auto mb-4" />
          <p className="text-ace-muted">No invoices yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <div key={inv.id} className="card">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">
                    ${Number(inv.total || 0).toLocaleString()}
                    {inv.kind ? <span className="text-ace-muted text-sm"> · {inv.kind}</span> : null}
                  </div>
                  <div className="text-xs text-ace-muted mt-1">
                    {inv.dueDate ? `Due ${fmtDate(inv.dueDate)}` : ''}
                    {inv.paidAt ? ` · Paid ${fmtDate(inv.paidAt)}` : ''}
                  </div>
                </div>
                <span className={`badge ${STATUS_TONE[inv.status] || STATUS_TONE.draft}`}>
                  {inv.status || 'draft'}
                </span>
              </div>
              {inv.paymentLink && inv.status !== 'paid' && (
                <a
                  href={inv.paymentLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block mt-3 text-sm px-4 py-2 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20"
                >
                  Pay now
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return iso;
  }
}
