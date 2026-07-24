import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { format, addDays } from 'date-fns';

const client = generateClient<Schema>();

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export default function InvoiceCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gigId = searchParams.get('gigId');

  const [gig, setGig] = useState<any>(null);
  const [clientRecord, setClientRecord] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: '', quantity: 1, unitPrice: 0, total: 0 }
  ]);
  const [discount, setDiscount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [depositPercent, setDepositPercent] = useState(50);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));

  useEffect(() => {
    async function loadGig() {
      if (!gigId) return;
      try {
        const { data: gigData } = await client.models.Gig.get({ id: gigId });
        setGig(gigData);
        if (gigData?.clientId) {
          const { data: clientData } = await client.models.Client.get({ id: gigData.clientId });
          setClientRecord(clientData);
        }
        // Pre-populate line items from gig services
        if (gigData?.services?.length) {
          const items: LineItem[] = gigData.services.map((svc: string) => ({
            description: svc,
            quantity: 1,
            unitPrice: gigData.quotedAmount ? Math.round(gigData.quotedAmount / gigData.services.length) : 0,
            total: gigData.quotedAmount ? Math.round(gigData.quotedAmount / gigData.services.length) : 0,
          }));
          setLineItems(items);
        }
      } catch (err) {
        console.error('Failed to load gig:', err);
      }
    }
    loadGig();
  }, [gigId]);

  const updateLineItem = (index: number, field: string, value: string | number) => {
    const updated = [...lineItems];
    (updated[index] as any)[field] = value;
    if (field === 'quantity' || field === 'unitPrice') {
      updated[index].total = updated[index].quantity * updated[index].unitPrice;
    }
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPrice: 0, total: 0 }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const subtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
  const discountAmount = discount;
  const total = subtotal - discountAmount;
  const depositRequired = Math.round(total * (depositPercent / 100));
  const balanceDue = total - depositRequired;

  const createInvoice = async () => {
    if (!gigId || !clientRecord) return;
    setSaving(true);
    try {
      const { data: invoice } = await client.models.Invoice.create({
        gigId,
        clientId: clientRecord.id,
        status: 'draft',
        dueDate,
        lineItems: JSON.stringify(lineItems),
        subtotal,
        discount: discountAmount || undefined,
        discountReason: discountReason || undefined,
        total,
        depositRequired,
        depositPaid: 0,
        balanceDue: total,
        notes: notes || undefined,
      });

      // Update gig with invoice reference and amounts
      await client.models.Gig.update({
        id: gigId,
        invoiceId: invoice?.id,
        quotedAmount: total,
        depositAmount: depositRequired,
        balanceAmount: balanceDue,
      });

      navigate(`/invoices/${invoice?.id}`);
    } catch (err) {
      console.error('Failed to create invoice:', err);
      alert('Failed to create invoice.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="text-ace-muted hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold">Create Invoice</h1>
      </div>

      {/* Client info */}
      {clientRecord && (
        <div className="card mb-6">
          <div className="text-sm">
            <strong>Bill to:</strong> {clientRecord.firstName} {clientRecord.lastName}
            {clientRecord.organization && <span className="text-ace-muted"> — {clientRecord.organization}</span>}
            <br />
            <span className="text-ace-muted">{clientRecord.email}</span>
          </div>
        </div>
      )}

      {/* Line Items */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-4">Line Items</h2>
        <div className="space-y-3">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 text-xs text-ace-muted uppercase tracking-wide px-1">
            <div className="col-span-5">Description</div>
            <div className="col-span-2">Qty</div>
            <div className="col-span-2">Unit Price</div>
            <div className="col-span-2">Total</div>
            <div className="col-span-1"></div>
          </div>

          {lineItems.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input
                className="input col-span-5 text-sm py-2"
                value={item.description}
                onChange={e => updateLineItem(i, 'description', e.target.value)}
                placeholder="Service or item"
              />
              <input
                className="input col-span-2 text-sm py-2"
                type="number"
                min="1"
                value={item.quantity}
                onChange={e => updateLineItem(i, 'quantity', parseInt(e.target.value) || 1)}
              />
              <input
                className="input col-span-2 text-sm py-2"
                type="number"
                min="0"
                value={item.unitPrice}
                onChange={e => updateLineItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
              />
              <div className="col-span-2 text-sm font-medium">${item.total.toLocaleString()}</div>
              <button
                onClick={() => removeLineItem(i)}
                className="col-span-1 text-red-400 hover:text-red-300 p-1"
                disabled={lineItems.length === 1}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          <button onClick={addLineItem} className="flex items-center gap-2 text-ace-cyan text-sm hover:underline mt-2">
            <Plus size={14} /> Add line item
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="card mb-6">
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-ace-muted">Subtotal</span>
            <span>${subtotal.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-ace-muted text-sm">Discount ($)</span>
            <input
              className="input w-24 text-sm py-2"
              type="number"
              min="0"
              value={discount}
              onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
            />
            <input
              className="input flex-1 text-sm py-2"
              placeholder="Discount reason (e.g. repeat client 10%)"
              value={discountReason}
              onChange={e => setDiscountReason(e.target.value)}
            />
          </div>

          <div className="flex justify-between text-lg font-bold pt-3 border-t border-ace-border">
            <span>Total</span>
            <span className="text-green-400">${total.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-ace-border">
            <span className="text-ace-muted text-sm">Deposit %</span>
            <input
              className="input w-20 text-sm py-2"
              type="number"
              min="0"
              max="100"
              value={depositPercent}
              onChange={e => setDepositPercent(parseInt(e.target.value) || 0)}
            />
            <span className="text-sm">= <strong>${depositRequired.toLocaleString()}</strong> deposit</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-ace-muted">Balance due after event</span>
            <span>${balanceDue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="card mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-ace-muted block mb-1">Due Date</label>
            <input
              className="input text-sm"
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-ace-muted block mb-1">Notes (visible to client)</label>
            <input
              className="input text-sm"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Payment terms, special notes..."
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={createInvoice} disabled={saving || total <= 0} className="btn-primary">
          {saving ? 'Creating...' : 'Create Invoice'}
        </button>
        <button onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
      </div>
    </div>
  );
}
