import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Calendar, Users, Package,
  Receipt, UserCog, Mail, Settings, LogOut, Menu
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Quotes', path: '/quotes', icon: FileText },
  { name: 'Gigs', path: '/gigs', icon: Calendar },
  { name: 'Clients', path: '/clients', icon: Users },
  { name: 'Equipment', path: '/equipment', icon: Package },
  { name: 'Invoices', path: '/invoices', icon: Receipt },
  { name: 'Crew', path: '/crew', icon: UserCog },
  { name: 'Subscribers', path: '/subscribers', icon: Mail },
  { name: 'Settings', path: '/settings', icon: Settings },
];

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  signOut: (() => void) | undefined;
}

export default function Layout({ children, user, signOut }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-ace-card border-r border-ace-border
        transform transition-transform duration-300 lg:translate-x-0 lg:static
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-ace-border">
            <h1 className="text-xl font-bold bg-gradient-to-r from-ace-cyan via-ace-purple to-ace-magenta bg-clip-text text-transparent">
              ACE Admin
            </h1>
            <p className="text-xs text-ace-muted mt-1">Atlanta Creative Exchange</p>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-ace-purple/15 text-white'
                      : 'text-ace-muted hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <item.icon size={18} />
                {item.name}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-ace-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-ace-purple/30 flex items-center justify-center text-sm font-bold">
                {user?.signInDetails?.loginId?.charAt(0)?.toUpperCase() || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.signInDetails?.loginId || 'Admin'}</p>
              </div>
              <button onClick={signOut} className="text-ace-muted hover:text-white transition-colors">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 bg-[#0e0e0e]/95 backdrop-blur-md border-b border-ace-border lg:hidden">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => setSidebarOpen(true)} className="text-white">
              <Menu size={24} />
            </button>
            <h1 className="text-sm font-bold bg-gradient-to-r from-ace-cyan to-ace-purple bg-clip-text text-transparent">
              ACE Admin
            </h1>
            <div className="w-6" />
          </div>
        </header>

        <main className="p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
