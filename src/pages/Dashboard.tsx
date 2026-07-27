import { useEffect, useState } from 'react';
import { listQuotes } from '../utils/api';
import { FileText, Calendar, Mail } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({ newQuotes: 0, totalQuotes: 0 });

  useEffect(() => {
    async function loadStats() {
      try {
        const quotes = await listQuotes();
        setStats({
          newQuotes: quotes.filter((q: any) => q.status === 'new').length,
          totalQuotes: quotes.length,
        });
      } catch (err) {
        console.error('Failed to load stats:', err);
      }
    }
    loadStats();
  }, []);

  const cards = [
    { label: 'New Quotes', value: stats.newQuotes, icon: FileText, color: 'text-ace-cyan' },
    { label: 'Total Quotes', value: stats.totalQuotes, icon: Calendar, color: 'text-ace-purple' },
  ];

  return (
    <div>
      {/* Welcome banner */}
      <div className="card mb-8 border-[rgba(123,47,247,0.2)] bg-gradient-to-r from-[#1e1e1e] to-[#1a1a2e]">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="ACE" className="h-12 rounded-lg" />
          <div>
            <h1 className="text-xl font-bold">Welcome back</h1>
            <p className="text-[#a0a0a0] text-sm">Atlanta Creative Exchange — Admin Portal</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {cards.map((stat) => (
          <div key={stat.label} className="card">
            <div className="flex items-center gap-3 mb-2">
              <stat.icon size={18} className={stat.color} />
              <span className="text-xs text-[#a0a0a0] uppercase tracking-wide">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Recent Quotes</h2>
          <p className="text-[#a0a0a0] text-sm">Click "Quotes" in the sidebar to view and manage all quote requests.</p>
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <a href="/quotes" className="block text-sm text-[#00b4d8] hover:underline">→ View Quotes</a>
            <a href="/settings" className="block text-sm text-[#00b4d8] hover:underline">→ Settings</a>
          </div>
        </div>
      </div>
    </div>
  );
}
