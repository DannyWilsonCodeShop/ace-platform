import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { ArrowLeft, Clock, MapPin, Music, Mic, Users, DollarSign, Brain, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { createPortalUser } from '../utils/createPortalUser';

const client = generateClient<Schema>();

const statusOptions = ['new', 'reviewed', 'quoted', 'accepted', 'declined', 'expired'];
const statusColors: Record<string, string> = {
  new: 'badge-new',
  reviewed: 'badge-reviewed',
  quoted: 'badge-quoted',
  accepted: 'badge-accepted',
  declined: 'badge-declined',
  expired: 'badge-declined',
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
    async function load() {
      if (!id) return;
      try {
        const { data } = await client.models.Quote.get({ id });
        setQuote(data);
        setNotes(data?.internalNotes || '');
        setQuotedAmount(data?.quotedAmount?.toString() || '');
      } catch (err) {
        console.error('Failed to load quote:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const updateStatus = async (status: string) => {
    if (!id) return;
    setSaving(true);
    try {
      await client.models.Quote.update({ id, status: status as any });
      setQuote({ ...quote, status });
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await client.models.Quote.update({
        id,
        internalNotes: notes,
        quotedAmount: quotedAmount ? parseFloat(quotedAmount) : null,
      });
      setQuote({ ...quote, internalNotes: notes, quotedAmount: parseFloat(quotedAmount) });
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const convertToGig = async () => {
    if (!quote) return;
    setSaving(true);
    try {
      // 1. Create or find client
      const { data: existingClients } = await client.models.Client.list({
        filter: { email: { eq: quote.email } }
      });

      let clientRecord;
      if (existingClients && existingClients.length > 0) {
        clientRecord = existingClients[0];
      } else {
        const { data: newClient } = await client.models.Client.create({
          firstName: quote.firstName,
          lastName: quote.lastName,
          email: quote.email,
          phone: quote.phone,
          organization: quote.organization || undefined,
          totalGigs: 0,
          totalRevenue: 0,
          isRepeatClient: false,
        });
        clientRecord = newClient;
      }

      if (!clientRecord) throw new Error('Failed to create client');

      // 2. Create gig
      const { data: newGig } = await client.models.Gig.create({
        quoteId: quote.id,
        clientId: clientRecord.id,
        status: 'upcoming',
        eventType: quote.eventType || 'Event',
        eventDates: quote.eventDates || '[]',
        services: quote.services || [],
        perDayDetails: quote.perDayDetails || undefined,
        venueName: quote.venueName || 'TBD',
        venueAddress: quote.venueAddress || 'TBD',
        roomName: quote.roomName || undefined,
        floorAccess: quote.floorAccess || undefined,
        indoorOutdoor: quote.indoorOutdoor || 'Indoor',
        roomSize: quote.roomSize || 'Medium',
        quotedAmount: quotedAmount ? parseFloat(quotedAmount) : undefined,
        depositAmount: 0,
        depositPaid: false,
        balanceAmount: quotedAmount ? parseFloat(quotedAmount) : 0,
        balancePaid: false,
        assignedCrew: [],
        equipmentIds: [],
        checklist: JSON.stringify({
          gearPacked: false, gearLoaded: false, arrivedAtVenue: false,
          setupComplete: false, soundCheck: false, eventStarted: false,
          eventEnded: false, gearBrokenDown: false, gearReturned: false
        }),
      });

      // 3. Update quote status
      await client.models.Quote.update({ id: quote.id, status: 'accepted' });

      // 4. Update client gig count
      await client.models.Client.update({
        id: clientRecord.id,
        totalGigs: (clientRecord.totalGigs || 0) + 1,
      });

      // 5. Create customer portal account
      try {
        const portalResult = await createPortalUser({
          action: 'createCustomer',
          email: quote.email,
          name: `${quote.firstName} ${quote.lastName}`,
          phone: quote.phone || undefined,
        });
        console.log('Customer portal account:', portalResult.message);
      } catch (err) {
        console.warn('Customer portal account creation failed (non-blocking):', err);
      }

      navigate(`/gigs/${newGig?.id}`);
    } catch (err) {
      console.error('Failed to convert to gig:', err);
      alert('Failed to convert quote to gig. Check console for details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-ace-muted">Loading quote...</div>;
  if (!quote) return <div className="text-ace-muted">Quote not found.</div>;

  const isEvent = quote.serviceType === 'event';
  const eventDates = quote.eventDates ? JSON.parse(quote.eventDates) : [];
  const perDayDetails = quote.perDayDetails ? JSON.parse(quote.perDayDetails) : null;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/quotes')} className="text-ace-muted hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{quote.firstName} {quote.lastName}</h1>
          <p className="text-ace-muted text-sm">{quote.email} &bull; {quote.phone}</p>
        </div>
        <span className={`badge ${statusColors[quote.status || 'new']}`}>{quote.status || 'new'}</span>
      </div>

      {/* Status actions */}
      <div className="card mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm text-ace-muted">Status:</span>
          {statusOptions.map(s => (
            <button
              key={s}
              onClick={() => updateStatus(s)}
              disabled={saving}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                quote.status === s
                  ? 'border-ace-purple bg-ace-purple/15 text-white'
                  : 'border-ace-border text-ace-muted hover:text-white hover:border-white/20'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Event/Digital info */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              {isEvent ? <Music size={18} className="text-ace-cyan" /> : <Brain size={18} className="text-ace-purple" />}
              {isEvent ? 'Event Details' : 'Project Details'}
            </h2>

            {isEvent ? (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-ace-muted">Type:</span> <strong>{quote.eventType}</strong></div>
                  <div><span className="text-ace-muted">Budget:</span> <strong>{quote.budget || 'Not disclosed'}</strong></div>
                </div>

                {eventDates.length > 0 && (
                  <div>
                    <span className="text-ace-muted block mb-1">Date(s):</span>
                    {eventDates.map((d: any, i: number) => (
                      <div key={i} className="ml-2 mb-1">
                        <strong>Day {i + 1}:</strong> {d.date} ({d.startTime} – {d.endTime})
                      </div>
                    ))}
                  </div>
                )}

                <div><span className="text-ace-muted">Services:</span> <strong>{quote.services?.join(', ')}</strong></div>
                {quote.genre && <div><span className="text-ace-muted">Genre:</span> {quote.genre}</div>}
                {quote.speeches && <div><span className="text-ace-muted">Speeches:</span> {quote.speeches}</div>}

                {perDayDetails && (
                  <div className="mt-4 p-3 bg-ace-bg rounded-lg">
                    <span className="text-ace-muted text-xs uppercase tracking-wide block mb-2">Per-Day Breakdown</span>
                    {perDayDetails.map((day: any, i: number) => (
                      <div key={i} className="mb-2 pb-2 border-b border-ace-border last:border-0">
                        <strong className="text-ace-cyan text-xs">Day {i + 1}:</strong>
                        <span className="ml-2">{day.services?.join(', ')}</span>
                        {day.notes && <p className="text-ace-muted ml-2 text-xs">{day.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div><span className="text-ace-muted">Services:</span> <strong>{quote.digitalServices?.join(', ')}</strong></div>
                <div><span className="text-ace-muted">Description:</span> <p className="mt-1">{quote.projectDescription}</p></div>
                {quote.hasExisting && <div><span className="text-ace-muted">Existing:</span> {quote.hasExisting}</div>}
                {quote.existingUrl && <div><span className="text-ace-muted">URL:</span> <a href={quote.existingUrl} className="text-ace-cyan" target="_blank">{quote.existingUrl}</a></div>}
                {quote.timeline && <div><span className="text-ace-muted">Timeline:</span> {quote.timeline}</div>}
                {quote.features?.length > 0 && <div><span className="text-ace-muted">Features:</span> {quote.features.join(', ')}</div>}
                {quote.designDirection && <div><span className="text-ace-muted">Design:</span> {quote.designDirection}</div>}
                {quote.digitalBudget && <div><span className="text-ace-muted">Budget:</span> <strong>{quote.digitalBudget}</strong></div>}
                {quote.ongoingSupport && <div><span className="text-ace-muted">Support:</span> {quote.ongoingSupport}</div>}
              </div>
            )}
          </div>

          {/* Venue (event only) */}
          {isEvent && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MapPin size={18} className="text-ace-cyan" />
                Venue
              </h2>
              <div className="space-y-2 text-sm">
                <div><strong>{quote.venueName}</strong></div>
                <div className="text-ace-muted">{quote.venueAddress}</div>
                {quote.roomName && <div><span className="text-ace-muted">Room:</span> {quote.roomName}</div>}
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div><span className="text-ace-muted">Indoor/Outdoor:</span> {quote.indoorOutdoor}</div>
                  <div><span className="text-ace-muted">Size:</span> <strong>{quote.roomSize}</strong></div>
                  <div><span className="text-ace-muted">Floor:</span> {quote.floorAccess}</div>
                  <div><span className="text-ace-muted">Power:</span> {quote.powerAvailability}</div>
                </div>
                {quote.loadInTime && <div><span className="text-ace-muted">Load-in:</span> {quote.loadInTime}</div>}
              </div>
            </div>
          )}

          {/* Equipment (event only) */}
          {isEvent && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Mic size={18} className="text-ace-cyan" />
                Equipment
              </h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-ace-muted">Wireless Mics:</span> {quote.micWireless || '0'}</div>
                <div><span className="text-ace-muted">Wired Mics:</span> {quote.micWired || '0'}</div>
                <div><span className="text-ace-muted">Monitors:</span> {quote.monitorSpeakers || 'None'}</div>
                <div><span className="text-ace-muted">Aux/Inputs:</span> {quote.auxInputs || 'None'}</div>
              </div>
              {quote.additionalNotes && (
                <div className="mt-3 text-sm">
                  <span className="text-ace-muted">Notes:</span>
                  <p className="mt-1">{quote.additionalNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* AI Analysis */}
          {quote.aiAnalysis && (
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Brain size={18} className="text-ace-magenta" />
                AI Analysis
              </h2>
              <pre className="text-sm text-ace-muted whitespace-pre-wrap leading-relaxed">{quote.aiAnalysis}</pre>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contact */}
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Users size={16} className="text-ace-cyan" />
              Contact
            </h3>
            <div className="space-y-2 text-sm">
              <div><strong>{quote.firstName} {quote.lastName}</strong></div>
              <div><a href={`mailto:${quote.email}`} className="text-ace-cyan hover:underline">{quote.email}</a></div>
              <div><a href={`tel:${quote.phone}`} className="text-ace-cyan hover:underline">{quote.phone}</a></div>
              {quote.organization && <div className="text-ace-muted">{quote.organization}</div>}
              {quote.howHeard && <div className="text-ace-muted text-xs">Found via: {quote.howHeard}</div>}
            </div>
          </div>

          {/* Pricing / Notes */}
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <DollarSign size={16} className="text-green-400" />
              Quote Amount
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-ace-muted block mb-1">Quoted Amount ($)</label>
                <input
                  type="number"
                  value={quotedAmount}
                  onChange={e => setQuotedAmount(e.target.value)}
                  className="input"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-xs text-ace-muted block mb-1">Internal Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="input min-h-[100px] resize-y"
                  placeholder="Notes for the team..."
                />
              </div>
              <button onClick={saveNotes} disabled={saving} className="btn-primary w-full text-sm">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="card">
            <h3 className="font-semibold mb-3">Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => updateStatus('accepted')}
                className="w-full flex items-center gap-2 justify-center px-4 py-2.5 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-colors text-sm"
              >
                <CheckCircle size={16} /> Accept Quote
              </button>
              <button
                onClick={() => updateStatus('declined')}
                className="w-full flex items-center gap-2 justify-center px-4 py-2.5 rounded-lg bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors text-sm"
              >
                <XCircle size={16} /> Decline
              </button>
              {quote.status === 'accepted' && (
                <button
                  onClick={convertToGig}
                  className="btn-primary w-full text-sm mt-2"
                >
                  Convert to Gig →
                </button>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="text-xs text-ace-muted space-y-1">
            <div>Submitted: {quote.createdAt ? format(new Date(quote.createdAt), 'MMM d, yyyy h:mm a') : 'Unknown'}</div>
            <div>Source: {quote.source || 'Website'}</div>
            <div>ID: {quote.id}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
