import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { ArrowLeft, Send, DollarSign, CheckCircle, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const client = generateClient<Schema>();

const statusColors: Record<string, string> = {
  draft: 'bg-white/10 text-ace-muted border-ace-border',
  sent: 'bg-ace-cyan/10 text-ace-cyan border-ace-cyan/30',
  viewed: 'bg-ace-purple/10 text-ace-purple border-ace-purple/30',
  partial: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  paid: 'bg-green-500/10 text-green-400 border-green-500/30',
  overdue: 'bg-red-500/10 text-red-400 border-red-500/30',
  cancelled: 'bg-white/10 text-ace-muted border-ace-border',
};

export default function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<any>(null);
  const [clientRecord, setClientRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const { data } = await client.models.Invoice.get({ id });
        setInvoice(data);
        if (data?.clientId) {
          const { data: cl } = await client.models.Client.get({ id: data.clientId });
          setClientRecord(cl);
        }
      } catch (err) {
        console.error('Failed to load invoice:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const markAsSent = async () => {
    if (!id) return;
    await client.models.Invoice.update({ id, status: 'sent', sentAt: new Date().toISOString() });
    setInvoice({ ...invoice, status: 'sent', sentAt: new Date().toISOString() });
  };

  const recordPayment = async () => {
    if (!id || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    const newDepositPaid = (invoice.depositPaid || 0) + amount;
    const newBalance = invoice.total - newDepositPaid;
    const isFullyPaid = newBalance <= 0;

    await client.models.Invoice.update({
      id,
      depositPaid: newDepositPaid,
      balanceDue: Math.max(0, newBalance),
      status: isFullyPaid ? 'paid' : 'partial',
      paidAt: isFullyPaid ? new Date().toISOString() : undefined,
    });

    // Update gig payment status
    if (invoice.gigId) {
      const depositTarget = invoice.depositRequired || 0;
      await client.models.Gig.update({
        id: invoice.gigId,
        depositPaid: newDepositPaid >= depositTarget,
        depositPaidAt: newDepositPaid >= depositTarget ? new Date().toISOString() : undefined,
        balancePaid: isFullyPaid,
        balancePaidAt: isFullyPaid ? new Date().toISOString() : undefined,
      });
    }

    // Update client revenue
    if (clientRecord) {
      await client.models.Client.update({
        id: clientRecord.id,
        totalRevenue: (clientRecord.totalRevenue || 0) + amount,
        isRepeatClient: (clientRecord.totalGigs || 0) > 1,
      });
    }

    setInvoice({
      ...invoice,
      depositPaid: newDepositPaid,
      balanceDue: Math.max(0, newBalance),
      status: isFullyPaid ? 'paid' : 'partial',
    });
    setPaymentAmount('');
  };

  if (loading) return <div className="text-ace-muted">Loading invoice...</div>;
  if (!invoice) return <div className="text-ace-muted">Invoice not found.</div>;

  const lineItems = invoice.lineItems ? JSON.parse(invoice.lineItems) : [];

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/invoices')} className="text-ace-muted hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Invoice</h1>
          <p className="text-ace-muted text-xs">ID: {invoice.id?.slice(0, 8)}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full border text-sm font-medium ${statusColors[invoice.status || 'draft']}`}>
          {invoice.status}
        </span>
      </div>

      {/* Client + dates */}
      <div className="card mb-6">
        <div className="flex justify-between text-sm">
          <div>
            <span className="text-ace-muted">Bill to:</span><br />
            <strong>{clientRecord?.firstName} {clientRecord?.lastName}</strong><br />
            <span className="text-ace-muted">{clientRecord?.email}</span>
          </div>
          <div className="text-right">
            <div><span className="text-ace-muted">Created:</span> {invoice.createdAt && format(parseISO(invoice.createdAt), 'MMM d, yyyy')}</div>
            <div><span className="text-ace-muted">Due:</span> <strong>{invoice.dueDate && format(parseISO(invoice.dueDate), 'MMM d, yyyy')}</strong></div>
            {invoice.sentAt && <div><span className="text-ace-muted">Sent:</span> {format(parseISO(invoice.sentAt), 'MMM d, yyyy')}</div>}
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-4">Items</h2>
        <div className="space-y-2">
          <div className="grid grid-cols-12 text-xs text-ace-muted uppercase tracking-wide pb-2 border-b border-ace-border">
            <div className="col-span-6">Description</div>
            <div className="col-span-2">Qty</div>
            <div className="col-span-2">Price</div>
            <div className="col-span-2 text-right">Total</div>
          </div>
          {lineItems.map((item: any, i: number) => (
            <div key={i} className="grid grid-cols-12 text-sm py-2">
              <div className="col-span-6">{item.description}</div>
              <div className="col-span-2 text-ace-muted">{item.quantity}</div>
              <div className="col-span-2 text-ace-muted">${item.unitPrice?.toLocaleString()}</div>
              <div className="col-span-2 text-right font-medium">${item.total?.toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div className="border-t border-ace-border mt-4 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-ace-muted">Subtotal</span>
            <span>${invoice.subtotal?.toLocaleString()}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-ace-muted">Discount {invoice.discountReason && `(${invoice.discountReason})`}</span>
              <span className="text-green-400">-${invoice.discount?.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-2">
            <span>Total</span>
            <span>${invoice.total?.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Payment status */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <DollarSign size={18} className="text-green-400" /> Payment Status
        </h2>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-ace-muted">Deposit required</span>
            <span>${invoice.depositRequired?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ace-muted">Paid so far</span>
            <span className="text-green-400">${(invoice.depositPaid || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>Balance due</span>
            <span className={invoice.balanceDue > 0 ? 'text-yellow-400' : 'text-green-400'}>
              ${invoice.balanceDue?.toLocaleString()}
              {invoice.balanceDue <= 0 && ' ✓ Paid in full'}
            </span>
          </div>

          {/* Payment progress */}
          <div className="h-3 bg-ace-bg rounded-full overflow-hidden mt-2">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-ace-cyan rounded-full transition-all"
              style={{ width: `${Math.min(100, ((invoice.depositPaid || 0) / invoice.total) * 100)}%` }}
            />
          </div>

          {/* Record payment */}
          {invoice.status !== 'paid' && (
            <div className="flex gap-2 mt-4 pt-3 border-t border-ace-border">
              <input
                type="number"
                className="input flex-1 text-sm"
                placeholder="Payment amount"
                value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
              />
              <button onClick={recordPayment} disabled={!paymentAmount} className="btn-primary text-sm flex items-center gap-2">
                <CheckCircle size={14} /> Record Payment
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {invoice.status === 'draft' && (
          <button onClick={markAsSent} className="btn-primary flex items-center gap-2">
            <Send size={16} /> Mark as Sent
          </button>
        )}
        <button onClick={() => navigate(`/gigs/${invoice.gigId}`)} className="btn-secondary text-sm">
          View Gig
        </button>
      </div>
    </div>
  );
}
