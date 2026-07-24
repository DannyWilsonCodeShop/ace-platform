import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { FileText, Calendar, DollarSign, AlertCircle, Users, Mail } from 'lucide-react';

const client = generateClient<Schema>();

export default function Dashboard() {
  const [stats, setStats] = useState({
    newQuotes: 0,
    upcomingGigs: 0,
    subscribers: 0,
  });

  useEffect(() => {
    async function loadStats() {
      try {
        const [quotes, gigs, subs] = await Promise.all([
          client.models.Quote.list({ filter: { status: { eq: 'new' } } }),
          client.models.Gig.list({ filter: { status: { eq: 'upcoming' } } }),
          client.models.Subscriber.list({ filter: { status: { eq: 'active' } } }),
        ]);
        setStats({
          newQuotes: quotes.data?.length || 0,
          upcomingGigs: gigs.data?.length || 0,
          subscribers: subs.data?.length || 0,
        });
      } catch (err) {
        console.error('Failed to load stats:', err);
      }
    }
    loadStats();
  }, []);

  const cards = [
    { label: 'New Quotes', value: stats.newQuotes, icon: FileText, color: 'text-ace-cyan' },
    { label: 'Upcoming Gigs', value: stats.upcomingGigs, icon: Calendar, color: 'text-ace-purple' },
    { label: 'Subscribers', value: stats.subscribers, icon: Mail, color: 'text-ace-magenta' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {cards.map((stat) => (
          <div key={stat.label} className="card">
            <div className="flex items-center gap-3 mb-2">
              <stat.icon size={18} className={stat.color} />
              <span className="text-xs text-ace-muted uppercase tracking-wide">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Recent Quotes</h2>
          <p className="text-ace-muted text-sm">Quotes will appear here as they come in from the website.</p>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Upcoming Gigs</h2>
          <p className="text-ace-muted text-sm">Confirmed bookings show here. Convert a quote to get started.</p>
        </div>
      </div>
    </div>
  );
}
