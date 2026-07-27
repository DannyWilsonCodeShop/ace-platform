import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getQuote, updateQuote } from '../utils/api';
import { ArrowLeft, MapPin, Music, Mic, Users, DollarSign, Brain, CheckCircle, XCircle, Calendar, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const statusOptions = ['new', 'reviewed', 'quoted', 'accepted', 'declined', 'expired'];
const statusColors: Record<string, string> = {
  new: 'badge-new', reviewed: 'badge-reviewed', quoted: 'badge-quoted',
  accepted: 'badge-accepted', declined: 'badge-declined', expired: 'badge-declined',
};

function Field({ label, value }: { label: string; value: any }) {
  const display = value === null || value === undefined || value === 'null' || value === 'True' || value === true
    ? '—' : String(value) || '—';
  return (
    <div className="py-2 border-b border-[rgba(255,255,255,0.03)] last:border-0">
      <span className="text-ace-muted text-xs uppercase tracking-wide">{label}</span>
      <div className="text-sm mt-0.5">{display}</div>
    </div>
  );
}

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [quotedAmount, setQuotedAmount] = useState('');

  useEffect(() => {
    if (!id) return;
    getQuote(id).then(data => {
      setQuote(data);
      setNotes(data?.internalNotes || '');
      setQuotedAmount(data?.quotedAmount?.toString() || '');
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  const handleUpdateStatus = async (status: string) => {
    if (!id) return;
    setSaving(true);
    try { await updateQuote({ id, status }); setQuote({ ...quote, status }); }
    catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleSaveNotes = async () => {
    if (!id) return;
    setSaving(true);
    try { await updateQuote({ id, internalNotes: notes, quotedAmount: quotedAmount ? parseFloat(quotedAmount) : null }); }
    catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleSendQuoteToClient = async () => {
    if (!quote || !quotedAmount) return;
    setSaving(true);
    try {
      const amount = parseFloat(quotedAmount);
      const response = await fetch('https://zuq0ae5dqf.execute-api.us-east-1.amazonaws.com/send-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: id,
          clientName: `${quote.firstName} ${quote.lastName}`,
          clientEmail: quote.email,
          eventType: quote.eventType,
          eventDates: eventDates,
          services: services,
          venueName: quote.venueName,
          roomSize: quote.roomSize,
          lineItems: [{ description: services.join(' + ') || 'Services', quantity: 1, unitPrice: amount, total: amount }],
          subtotal: amount,
          discount: 0,
          total: amount,
          depositRequired: Math.round(amount * 0.5),
          notes: notes || '',
          validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        }),
      });
      const result = await response.json();
      if (result.success) {
        alert(`Quote sent to ${quote.email}!`);
        await handleUpdateStatus('quoted');
      } else {
        alert('Failed to send: ' + (result.error || 'Unknown error'));
      }
    } catch (err) { console.error(err); alert('Failed to send quote.'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="text-ace-muted">Loading quote...</div>;
  if (!quote) return <div className="text-ace-muted">Quote not found.</div>;

  // Parse JSON fields safely
  const eventDates = (() => { try { const p = typeof quote.eventDates === 'string' ? JSON.parse(quote.eventDates) : quote.eventDates; return Array.isArray(p) ? p : []; } catch { return []; } })();
  const perDayDetails = (() => { try { if (!quote.perDayDetails || quote.perDayDetails === 'True' || quote.perDayDetails === true) return []; const p = typeof quote.perDayDetails === 'string' ? JSON.parse(quote.perDayDetails) : quote.perDayDetails; return Array.isArray(p) ? p : []; } catch { return []; } })();
  const services = Array.isArray(quote.services) ? quote.services.filter(Boolean) : [];
  const isEvent = quote.serviceType !== 'digital';

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/quotes')} className="text-ace-muted hover:text-white"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{quote.firstName} {quote.lastName}</h1>
          <p className="text-ace-muted text-sm">{quote.email} • {quote.phone}</p>
        </div>
        <span className={`badge ${statusColors[quote.status || 'new']}`}>{quote.status || 'new'}</span>
      </div>

      {/* Status */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-ace-muted mr-2">Status:</span>
          {statusOptions.map(s => (
            <button key={s} onClick={() => handleUpdateStatus(s)} disabled={saving}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${quote.status === s ? 'border-ace-purple bg-ace-purple/15 text-white' : 'border-[rgba(255,255,255,0.06)] text-ace-muted hover:text-white'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Dates */}
          {isEvent && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Calendar size={18} className="text-ace-cyan" />
                Event Date{eventDates.length > 1 ? `s (${eventDates.length} days)` : ''}
              </h2>
              {eventDates.length > 0 ? eventDates.map((d: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-[#0e0e0e] rounded-lg mb-2">
                  <span className="text-ace-cyan font-semibold text-sm">Day {i + 1}</span>
                  <span className="text-sm">{d.date ? format(parseISO(d.date), 'EEEE, MMMM d, yyyy') : '—'}</span>
                  <span className="text-ace-muted text-sm flex items-center gap-1"><Clock size={12}/> {d.startTime || '—'} – {d.endTime || '—'}</span>
                </div>
              )) : <p className="text-ace-muted text-sm">No dates provided</p>}
            </div>
          )}

          {/* Event Details - ALL fields shown */}
          {isEvent && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Music size={18} className="text-ace-cyan" /> Event Details</h2>
              <Field label="Event Type" value={quote.eventType} />
              <Field label="Services Requested" value={services.join(', ')} />
              <Field label="Same Services All Dates" value={quote.sameServicesAllDates === true || quote.sameServicesAllDates === 'true' ? 'Yes' : quote.sameServicesAllDates === false ? 'No' : quote.sameServicesAllDates} />
              <Field label="Genre / Vibe" value={quote.genre} />
              <Field label="Band Type" value={quote.bandType} />
              <Field label="Speeches / Toasts" value={quote.speeches} />
              <Field label="Budget" value={quote.budget} />
            </div>
          )}

          {/* Per-Day Breakdown */}
          {perDayDetails.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-3">Per-Day Breakdown</h2>
              {perDayDetails.map((day: any, i: number) => (
                <div key={i} className="p-3 bg-[#0e0e0e] rounded-lg mb-2">
                  <div className="text-ace-cyan font-semibold text-sm mb-2">Day {i + 1}</div>
                  <Field label="Services" value={Array.isArray(day.services) ? day.services.join(', ') : day.services} />
                  <Field label="Genre" value={day.genre} />
                  <Field label="Band Type" value={day.bandType} />
                  <Field label="Wireless Mics" value={day.micWireless} />
                  <Field label="Wired Mics" value={day.micWired} />
                  <Field label="Aux / Inputs" value={day.auxInputs} />
                  <Field label="Speeches" value={day.speeches} />
                  <Field label="Venue" value={day.venueName} />
                  <Field label="Address" value={day.venueAddress} />
                  <Field label="Room Size" value={day.roomSize} />
                  <Field label="Event Flow" value={day.notes} />
                </div>
              ))}
            </div>
          )}

          {/* Venue - ALL fields shown */}
          {isEvent && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><MapPin size={18} className="text-ace-cyan" /> Venue</h2>
              <Field label="Venue Name" value={quote.venueName} />
              <Field label="Address" value={quote.venueAddress} />
              <Field label="Room / Space" value={quote.roomName} />
              <Field label="Indoor / Outdoor" value={quote.indoorOutdoor} />
              <Field label="Room Size" value={quote.roomSize} />
              <Field label="Floor / Access" value={quote.floorAccess} />
              <Field label="Power Availability" value={quote.powerAvailability} />
              <Field label="Load-in Time" value={quote.loadInTime} />
            </div>
          )}

          {/* Equipment - ALL fields shown */}
          {isEvent && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Mic size={18} className="text-ace-cyan" /> Equipment</h2>
              <Field label="Wireless Microphones" value={quote.micWireless} />
              <Field label="Wired Microphones" value={quote.micWired} />
              <Field label="Monitor Speakers" value={quote.monitorSpeakers} />
              <Field label="Aux / Instrument Inputs" value={quote.auxInputs} />
            </div>
          )}

          {/* Notes */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-3">Event Flow & Special Instructions</h2>
            <p className="text-sm">{quote.additionalNotes || '—'}</p>
          </div>

          {/* Digital */}
          {quote.serviceType === 'digital' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Brain size={18} className="text-ace-purple" /> Digital Project</h2>
              <Field label="Services" value={Array.isArray(quote.digitalServices) ? quote.digitalServices.join(', ') : quote.digitalServices} />
              <Field label="Description" value={quote.projectDescription} />
              <Field label="Existing Site" value={quote.hasExisting} />
              <Field label="URL" value={quote.existingUrl} />
              <Field label="Pages / Screens" value={quote.pageCount} />
              <Field label="Timeline" value={quote.timeline} />
              <Field label="Features" value={Array.isArray(quote.features) ? quote.features.join(', ') : quote.features} />
              <Field label="Design Direction" value={quote.designDirection} />
              <Field label="Reference Sites" value={quote.referenceSites} />
              <Field label="Budget" value={quote.digitalBudget} />
              <Field label="Ongoing Support" value={quote.ongoingSupport} />
              <Field label="Notes" value={quote.digitalNotes} />
            </div>
          )}

          {/* AI Analysis - concise, quote first */}
          {quote.aiAnalysis && !quote.aiAnalysis.includes('unavailable') && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Brain size={18} className="text-ace-magenta" /> AI Quote Recommendation</h2>
              <pre className="text-sm text-ace-muted whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">{quote.aiAnalysis}</pre>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Users size={16} className="text-ace-cyan" /> Contact</h3>
            <Field label="Name" value={`${quote.firstName} ${quote.lastName}`} />
            <Field label="Email" value={quote.email} />
            <Field label="Phone" value={quote.phone} />
            <Field label="Organization" value={quote.organization} />
            <Field label="How Heard" value={quote.howHeard} />
            <Field label="May Call" value={quote.mayCall} />
          </div>

          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><DollarSign size={16} className="text-green-400" /> Quote Amount</h3>
            <input type="number" value={quotedAmount} onChange={e => setQuotedAmount(e.target.value)} className="input mb-3" placeholder="0.00" />
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input min-h-[80px] resize-y mb-3" placeholder="Internal notes..." />
            <button onClick={handleSaveNotes} disabled={saving} className="btn-primary w-full text-sm">{saving ? 'Saving...' : 'Save'}</button>
          </div>

          <div className="card space-y-2">
            <button onClick={handleSendQuoteToClient} disabled={saving || !quotedAmount}
              className="w-full flex items-center gap-2 justify-center px-4 py-2.5 rounded-lg bg-ace-purple/15 text-ace-purple border border-ace-purple/20 text-sm">
              <DollarSign size={16}/> Send Quote to Client
            </button>
            <button onClick={() => handleUpdateStatus('accepted')}
              className="w-full flex items-center gap-2 justify-center px-4 py-2.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 text-sm">
              <CheckCircle size={16}/> Accept
            </button>
            <button onClick={() => handleUpdateStatus('declined')}
              className="w-full flex items-center gap-2 justify-center px-4 py-2.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 text-sm">
              <XCircle size={16}/> Decline
            </button>
          </div>

          <div className="text-xs text-ace-muted space-y-1">
            <div>Submitted: {quote.createdAt && format(parseISO(quote.createdAt), 'MMM d, yyyy h:mm a')}</div>
            <div>Source: {quote.source || '—'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
