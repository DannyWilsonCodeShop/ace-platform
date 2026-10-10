import { useEffect, useState } from 'react';
import { listQuotes, listProjects, listInvoices } from '../utils/api';
import { FileText, FolderKanban, TrendingUp, DollarSign } from 'lucide-react';

// App-dev lifecycle status sets (derived from the amplify data model enums):
// Projects actively owned/worked (everything except terminal states).
const ACTIVE_PROJECT_STATUSES = ['planning', 'contract_pending', 'active', 'in_review', 'maintenance'];
// Open quote opportunities counted toward pipeline value.
const PIPELINE_QUOTE_STATUSES = ['new', 'reviewed', 'quoted'];
// Invoice statuses that are owed but not yet paid.
const OUTSTANDING_INVOICE_STATUSES = ['sent', 'viewed', 'partial', 'overdue'];

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export default function Dashboard() {
  const [stats, setStats] = useState({
    newLeads: 0,
    activeProjects: 0,
    pipeline: 0,
    pipelineCount: 0,
    revenue: 0,
    outstanding: 0,
  });

  useEffect(() => {
    async function load() {
      try {
        const [quotes, projects, invoices] = await Promise.all([
          listQuotes(), listProjects(), listInvoices()
        ]);

        const safeQuotes = quotes ?? [];
        const safeProjects = projects ?? [];
        const safeInvoices = invoices ?? [];

        const newLeads = safeQuotes.filter((q: any) => q?.status === 'new').length;

        const activeProjects = safeProjects.filter(
          (p: any) => ACTIVE_PROJECT_STATUSES.includes(p?.status)
        ).length;

        const inFlightQuotes = safeQuotes.filter(
          (q: any) => PIPELINE_QUOTE_STATUSES.includes(q?.status)
        );
        const pipeline = inFlightQuotes.reduce((sum: number, q: any) => {
          const n = q?.quotedAmount ?? q?.finalAmount ?? parseFloat(q?.digitalBudget ?? '');
          return sum + (Number.isFinite(n) ? n : 0);
        }, 0);
        const pipelineCount = inFlightQuotes.length;

        const revenue = safeInvoices
          .filter((i: any) => i?.status === 'paid')
          .reduce((sum: number, i: any) => sum + (Number(i?.total) || 0), 0);

        const outstanding = safeInvoices
          .filter((i: any) => OUTSTANDING_INVOICE_STATUSES.includes(i?.status))
          .reduce((sum: number, i: any) => sum + (Number(i?.total) || 0), 0);

        setStats({ newLeads, activeProjects, pipeline, pipelineCount, revenue, outstanding });
      } catch (err) { console.error(err); }
    }
    load();
  }, []);

  const cards = [
    { label: 'New Leads', value: String(stats.newLeads), icon: FileText, color: 'text-ace-cyan' },
    { label: 'Active Projects', value: String(stats.activeProjects), icon: FolderKanban, color: 'text-ace-purple' },
    {
      label: 'Pipeline',
      value: stats.pipeline > 0
        ? currency.format(stats.pipeline)
        : `${stats.pipelineCount} open`,
      icon: TrendingUp,
      color: 'text-ace-cyan',
    },
    {
      label: 'Revenue',
      value: currency.format(stats.revenue),
      icon: DollarSign,
      color: 'text-ace-magenta',
      sub: `Outstanding: ${currency.format(stats.outstanding)}`,
    },
  ];

  return (
    <div>
      <div className="card mb-8 border-ace-purple/20 bg-gradient-to-r from-[#1e1e1e] to-[#1a1a2e]">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="ACE" className="h-12 rounded-lg" />
          <div>
            <h1 className="text-xl font-bold">Welcome back</h1>
            <p className="text-ace-muted text-sm">Atlanta Creative Exchange — App Development Studio Admin</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((stat) => (
          <div key={stat.label} className="card">
            <div className="flex items-center gap-3 mb-2">
              <stat.icon size={18} className={stat.color} />
              <span className="text-xs text-ace-muted uppercase tracking-wide">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            {stat.sub && <p className="text-xs text-ace-muted mt-1">{stat.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
