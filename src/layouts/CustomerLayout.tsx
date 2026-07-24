import { NavLink } from 'react-router-dom';
import { Calendar, Receipt, MessageSquare, LogOut } from 'lucide-react';

const navigation = [
  { name: 'My Events', path: '/portal', icon: Calendar },
  { name: 'Invoices & Payments', path: '/portal/invoices', icon: Receipt },
  { name: 'Messages', path: '/portal/messages', icon: MessageSquare },
];

interface CustomerLayoutProps {
  children: React.ReactNode;
  user: any;
  signOut: (() => void) | undefined;
}

export default function CustomerLayout({ children, user, signOut }: CustomerLayoutProps) {
  return (
    <div className="min-h-screen">
      {/* Top nav */}
      <header className="sticky top-0 z-50 bg-[#0e0e0e]/95 backdrop-blur-md border-b border-[rgba(255,255,255,0.06)]">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <h1 className="text-lg font-bold bg-gradient-to-r from-ace-cyan via-ace-purple to-ace-magenta bg-clip-text text-transparent">
            ACE Portal
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-ace-muted hidden sm:inline">{user?.signInDetails?.loginId}</span>
            <button onClick={signOut} className="text-ace-muted hover:text-white transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Tab nav */}
        <nav className="max-w-4xl mx-auto px-4 flex gap-1">
          {navigation.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/portal'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-ace-purple text-white'
                    : 'border-transparent text-ace-muted hover:text-white'
                }`
              }
            >
              <item.icon size={16} />
              {item.name}
            </NavLink>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
