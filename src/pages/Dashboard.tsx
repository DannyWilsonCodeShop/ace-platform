import { useEffect, useState } from 'react';
import { listQuotes, listGigs, listSubscribers } from '../utils/api';
import { FileText, Calendar, Mail } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({ newQuotes: 0, upcomingGigs: 0, subscribers: 0 });

  useEffect(() => {
    async function load() {
      try {
        const [quotes, gigs, subs] = await Promise.all([
          listQuotes(), listGigs(), listSubscribers()
        ]);
        setStats({
          newQuotes: quotes.filter((q: any) => q.status === 'new').length,
          upcomingGigs: gigs.filter((g: any) => g.status === 'upcoming').length,
          subscribers: subs.filter((s: any) => s.status === 'active').length,
        });
      } catch (err) { console.error(err); }
    }
    load();
  }, []);

  const cards = [
    { label: 'New Quotes', value: stats.newQuotes, icon: FileText, color: 'text-ace-cyan' },
    { label: 'Upcoming Gigs', value: stats.upcomingGigs, icon: Calendar, color: 'text-ace-purple' },
    { label: 'Subscribers', value: stats.subscribers, icon: Mail, color: 'text-ace-magenta' },
  ];

  return (
    <div>
      <div className="card mb-8 border-ace-purple/20 bg-gradient-to-r from-[#1e1e1e] to-[#1a1a2e]">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="ACE" className="h-12 rounded-lg" />
          <div>
            <h1 className="text-xl font-bold">Welcome back</h1>
            <p className="text-ace-muted text-sm">Atlanta Creative Exchange — Admin Portal</p>
          </div>
        </div>
      </div>
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
    </div>
  );
}
