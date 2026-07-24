import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import { Receipt, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const client = generateClient<Schema>();

const statusDisplay: Record<string, { icon: any; label: string; color: string }> = {
  draft: { icon: Clock, label: 'Preparing', color: 'text-ace-muted' },
  sent: { icon: Receipt, label: 'Awaiting Payment', color: 'text-ace-cyan' },
  viewed: { icon: Receipt, label: 'Awaiting Payment', color: 'text-ace-cyan' },
  partial: { icon: Clock, label: 'Partially Paid', color: 'text-yellow-400' },
  paid: { icon: CheckCircle, label: 'Paid in Full', color: 'text-green-400' },
  overdue: { icon: AlertTriangle, label: 'Overdue', color: 'text-red-400' },
};

export default function MyInvoices() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await client.models.Invoice.list({ limit: 50 });
        setInvoices(data || []);
      } catch (err) {
        console.error('Failed to load invoices:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="text-ace-muted text-center py-12">Loading invoices...</div>;

  if (invoices.length === 0) {
    return (
      <div className="text-center py-16">
        <Receipt size={48} className="text-ace-muted mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Invoices Yet</h2>
        <p className="text-ace-muted">Invoices will appear here once your booking is confirmed and priced.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Invoices & Payments</h2>

      {/* Payment terms reminder */}
      <div className="card mb-6 border-ace-purple/20 bg-ace-purple/5">
        <p className="text-sm text-ace-muted">
          <strong className="text-white">Payment Terms:</strong> A deposit is required to secure your date. The remaining balance is due within 24 hours of event completion.
        </p>
      </div>

      <div className="space-y-4">
        {invoices.map(inv => {
          const status = statusDisplay[inv.status] || statusDisplay.sent;
          const lineItems = inv.lineItems ? JSON.parse(inv.lineItems) : [];
          const StatusIcon = status.icon;

          return (
            <div key={inv.id} className="card">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <StatusIcon size={18} className={status.color} />
                  <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
                </div>
                <span className="text-lg font-bold">${inv.total?.toLocaleString()}</span>
              </div>

              {/* Line items */}
              <div className="space-y-1 mb-4">
                {lineItems.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-ace-muted">{item.description}</span>
                    <span>${item.total?.toLocaleString()}</span>
                  </div>
                ))}
                {inv.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-400">
                    <span>Discount{inv.discountReason && ` (${inv.discountReason})`}</span>
                    <span>-${inv.discount?.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Payment progress */}
              <div className="pt-3 border-t border-[rgba(255,255,255,0.06)]">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-ace-muted">Paid: ${(inv.depositPaid || 0).toLocaleString()}</span>
                  <span className="text-ace-muted">Remaining: ${inv.balanceDue?.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-[#0e0e0e] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-ace-cyan rounded-full transition-all"
                    style={{ width: `${Math.min(100, ((inv.depositPaid || 0) / inv.total) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Due date */}
              <div className="flex justify-between text-xs text-ace-muted mt-3">
                <span>Due: {inv.dueDate && format(parseISO(inv.dueDate), 'MMMM d, yyyy')}</span>
                {inv.paymentLink && (
                  <a href={inv.paymentLink} className="text-ace-cyan hover:underline" target="_blank">
                    Pay Online →
                  </a>
                )}
              </div>

              {inv.notes && (
                <p className="text-sm text-ace-muted mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                  {inv.notes}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
