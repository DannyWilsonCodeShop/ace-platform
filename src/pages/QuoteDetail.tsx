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
    try {
      await updateQuote({ id, status });
      setQuote({ ...quote, status });
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleSaveNotes = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await updateQuote({ id, internalNotes: notes, quotedAmount: quotedAmount ? parseFloat(quotedAmount) : null });
      setQuote({ ...quote, internalNotes: notes, quotedAmount: parseFloat(quotedAmount) });
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="text-ace-muted">Loading quote...</div>;
  if (!quote) return <div className="text-ace-muted">Quote not found.</div>;

  // Safe parsing
  const eventDates = (() => {
    try {
      if (!quote.eventDates) return [];
      const parsed = typeof quote.eventDates === 'string' ? JSON.parse(quote.eventDates) : quote.eventDates;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  })();

  const perDayDetails = (() => {
    try {
      if (!quote.perDayDetails || quote.perDayDetails === 'true' || quote.perDayDetails === true) return null;
      const parsed = typeof quote.perDayDetails === 'string' ? JSON.parse(quote.perDayDetails) : quote.perDayDetails;
      return Array.isArray(parsed) ? parsed : null;
    } catch { return null; }
  })();

  const services = Array.isArray(quote.services) ? quote.services.filter(Boolean) : [];
  const isEvent = quote.serviceType === 'event' || quote.serviceType !== 'digital';
  const isMultiDay = eventDates.length > 1;

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

      {/* Status pipeline */}
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

          {/* Event Dates */}
          {isEvent && eventDates.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Calendar size={18} className="text-ace-cyan" />
                Event Date{isMultiDay ? 's' : ''} {isMultiDay && <span className="badge badge-new">{eventDates.length} days</span>}
              </h2>
              <div className="space-y-3">
                {eventDates.map((d: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-[#0e0e0e] rounded-lg">
                    <div className="text-ace-cyan font-semibold text-sm">Day {i + 1}</div>
                    <div className="text-sm">
                      {d.date && format(parseISO(d.date), 'EEEE, MMMM d, yyyy')}
                    </div>
                    <div className="flex items-center gap-1 text-ace-muted text-sm">
                      <Clock size={12} /> {d.startTime} – {d.endTime}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Services & Event Info */}
          {isEvent && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Music size={18} className="text-ace-cyan" /> Event Details
              </h2>
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <div><span className="text-ace-muted">Type:</span> <strong>{quote.eventType}</strong></div>
                <div><span className="text-ace-muted">Budget:</span> <strong>{quote.budget || 'Not disclosed'}</strong></div>
                <div className="col-span-2"><span className="text-ace-muted">Services:</span> <strong>{services.join(', ') || 'None specified'}</strong></div>
                {quote.genre && <div><span className="text-ace-muted">Genre:</span> {quote.genre}</div>}
                {quote.bandType && <div><span className="text-ace-muted">Band Type:</span> {quote.bandType}</div>}
                {quote.speeches && <div><span className="text-ace-muted">Speeches/Toasts:</span> {quote.speeches}</div>}
                {quote.sameServicesAllDates === false && <div className="col-span-2"><span className="text-ace-muted">Same services all dates:</span> <span className="text-yellow-400">No — different per day</span></div>}
              </div>
            </div>
          )}

          {/* Per-Day Breakdown */}
          {perDayDetails && Array.isArray(perDayDetails) && perDayDetails.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4">Per-Day Breakdown</h2>
              <div className="space-y-3">
                {perDayDetails.map((day: any, i: number) => (
                  <div key={i} className="p-3 bg-[#0e0e0e] rounded-lg">
                    <div className="text-ace-cyan font-semibold text-sm mb-2">Day {i + 1}</div>
                    {day.services && <div className="text-sm mb-1"><span className="text-ace-muted">Services:</span> {Array.isArray(day.services) ? day.services.join(', ') : day.services}</div>}
                    {day.genre && <div className="text-sm mb-1"><span className="text-ace-muted">Genre:</span> {day.genre}</div>}
                    {day.bandType && <div className="text-sm mb-1"><span className="text-ace-muted">Band Type:</span> {day.bandType}</div>}
                    {day.micWireless && day.micWireless !== '0' && <div className="text-sm mb-1"><span className="text-ace-muted">Wireless Mics:</span> {day.micWireless}</div>}
                    {day.micWired && day.micWired !== '0' && <div className="text-sm mb-1"><span className="text-ace-muted">Wired Mics:</span> {day.micWired}</div>}
                    {day.auxInputs && <div className="text-sm mb-1"><span className="text-ace-muted">Aux/Inputs:</span> {day.auxInputs}</div>}
                    {day.speeches && <div className="text-sm mb-1"><span className="text-ace-muted">Speeches:</span> {day.speeches}</div>}
                    {day.venueName && <div className="text-sm mb-1"><span className="text-ace-muted">Venue:</span> {day.venueName}, {day.venueAddress}</div>}
                    {day.roomSize && <div className="text-sm mb-1"><span className="text-ace-muted">Size:</span> {day.roomSize}</div>}
                    {day.notes && <div className="text-sm text-ace-muted italic mt-1">{day.notes}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Venue */}
          {isEvent && quote.venueName && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MapPin size={18} className="text-ace-cyan" /> Venue
              </h2>
              <div className="space-y-2 text-sm">
                <div><strong>{quote.venueName}</strong></div>
                <div className="text-ace-muted">{quote.venueAddress}</div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {quote.roomName && quote.roomName !== 'true' && <div><span className="text-ace-muted">Room:</span> {quote.roomName}</div>}
                  {quote.indoorOutdoor && <div><span className="text-ace-muted">Indoor/Outdoor:</span> {quote.indoorOutdoor}</div>}
                  {quote.roomSize && <div><span className="text-ace-muted">Size:</span> <strong>{quote.roomSize}</strong></div>}
                  {quote.floorAccess && <div><span className="text-ace-muted">Floor:</span> {quote.floorAccess}</div>}
                  {quote.powerAvailability && <div><span className="text-ace-muted">Power:</span> {quote.powerAvailability}</div>}
                  {quote.loadInTime && <div><span className="text-ace-muted">Load-in:</span> {quote.loadInTime}</div>}
                </div>
              </div>
            </div>
          )}

          {/* Equipment */}
          {isEvent && (quote.micWireless !== '0' || quote.micWired !== '0' || quote.auxInputs || quote.monitorSpeakers) && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Mic size={18} className="text-ace-cyan" /> Equipment
              </h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {quote.micWireless && quote.micWireless !== '0' && <div><span className="text-ace-muted">Wireless Mics:</span> {quote.micWireless}</div>}
                {quote.micWired && quote.micWired !== '0' && <div><span className="text-ace-muted">Wired Mics:</span> {quote.micWired}</div>}
                {quote.monitorSpeakers && <div><span className="text-ace-muted">Monitors:</span> {quote.monitorSpeakers}</div>}
                {quote.auxInputs && <div><span className="text-ace-muted">Aux/Inputs:</span> {quote.auxInputs}</div>}
              </div>
            </div>
          )}

          {/* Additional Notes */}
          {quote.additionalNotes && (
            <div className="card">
              <h2 className="text-sm font-semibold text-ace-muted uppercase tracking-wide mb-2">Event Flow & Notes</h2>
              <p className="text-sm">{quote.additionalNotes}</p>
            </div>
          )}

          {/* Digital Project */}
          {quote.serviceType === 'digital' && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Brain size={18} className="text-ace-purple" /> Digital Project
              </h2>
              <div className="space-y-2 text-sm">
                {quote.digitalServices && <div><span className="text-ace-muted">Services:</span> <strong>{Array.isArray(quote.digitalServices) ? quote.digitalServices.join(', ') : quote.digitalServices}</strong></div>}
                {quote.projectDescription && <div><span className="text-ace-muted">Description:</span><p className="mt-1">{quote.projectDescription}</p></div>}
                {quote.hasExisting && <div><span className="text-ace-muted">Existing:</span> {quote.hasExisting}</div>}
                {quote.existingUrl && <div><span className="text-ace-muted">URL:</span> <a href={quote.existingUrl} className="text-ace-cyan" target="_blank">{quote.existingUrl}</a></div>}
                {quote.timeline && <div><span className="text-ace-muted">Timeline:</span> {quote.timeline}</div>}
                {quote.features && <div><span className="text-ace-muted">Features:</span> {Array.isArray(quote.features) ? quote.features.join(', ') : quote.features}</div>}
                {quote.designDirection && <div><span className="text-ace-muted">Design:</span> {quote.designDirection}</div>}
                {quote.digitalBudget && <div><span className="text-ace-muted">Budget:</span> <strong>{quote.digitalBudget}</strong></div>}
                {quote.ongoingSupport && <div><span className="text-ace-muted">Support:</span> {quote.ongoingSupport}</div>}
              </div>
            </div>
          )}

          {/* AI Analysis */}
          {quote.aiAnalysis && !quote.aiAnalysis.includes('unavailable') && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Brain size={18} className="text-ace-magenta" /> AI Quote Analysis
              </h2>
              <pre className="text-sm text-ace-muted whitespace-pre-wrap leading-relaxed">{quote.aiAnalysis}</pre>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact */}
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><Users size={16} className="text-ace-cyan" /> Contact</h3>
            <div className="space-y-2 text-sm">
              <div><strong>{quote.firstName} {quote.lastName}</strong></div>
              <div><a href={`mailto:${quote.email}`} className="text-ace-cyan hover:underline">{quote.email}</a></div>
              <div><a href={`tel:${quote.phone}`} className="text-ace-cyan hover:underline">{quote.phone}</a></div>
              {quote.organization && quote.organization !== 'true' && <div className="text-ace-muted">{quote.organization}</div>}
              {quote.howHeard && <div className="text-ace-muted text-xs">Found via: {quote.howHeard}</div>}
            </div>
          </div>

          {/* Pricing */}
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2"><DollarSign size={16} className="text-green-400" /> Quote Amount</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-ace-muted block mb-1">Amount ($)</label>
                <input type="number" value={quotedAmount} onChange={e => setQuotedAmount(e.target.value)} className="input" placeholder="0.00" />
              </div>
              <div>
                <label className="text-xs text-ace-muted block mb-1">Internal Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input min-h-[80px] resize-y" placeholder="Notes..." />
              </div>
              <button onClick={handleSaveNotes} disabled={saving} className="btn-primary w-full text-sm">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>

          {/* Actions */}
          <div className="card space-y-2">
            <button onClick={() => handleUpdateStatus('accepted')} className="w-full flex items-center gap-2 justify-center px-4 py-2.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 text-sm">
              <CheckCircle size={16} /> Accept
            </button>
            <button onClick={() => handleUpdateStatus('declined')} className="w-full flex items-center gap-2 justify-center px-4 py-2.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 text-sm">
              <XCircle size={16} /> Decline
            </button>
          </div>

          {/* Meta */}
          <div className="text-xs text-ace-muted space-y-1">
            <div>Submitted: {quote.createdAt && format(parseISO(quote.createdAt), 'MMM d, yyyy h:mm a')}</div>
            <div>Source: {quote.source || 'Website'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
