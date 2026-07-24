import { Authenticator } from '@aws-amplify/ui-react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useEffect, useState } from 'react';

// Admin pages
import Layout from './layouts/Layout';
import Dashboard from './pages/Dashboard';
import Quotes from './pages/Quotes';
import QuoteDetail from './pages/QuoteDetail';
import Gigs from './pages/Gigs';
import GigDetail from './pages/GigDetail';
import Clients from './pages/Clients';
import Equipment from './pages/Equipment';
import Invoices from './pages/Invoices';
import InvoiceDetail from './pages/InvoiceDetail';
import InvoiceCreate from './pages/InvoiceCreate';
import Crew from './pages/Crew';
import Subscribers from './pages/Subscribers';
import Settings from './pages/Settings';

// Customer portal pages
import CustomerLayout from './layouts/CustomerLayout';
import MyEvents from './pages/portal/MyEvents';
import MyInvoices from './pages/portal/MyInvoices';
import MyMessages from './pages/portal/MyMessages';

import '@aws-amplify/ui-react/styles.css';

function AppContent({ signOut, user }: { signOut: (() => void) | undefined; user: any }) {
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getGroups() {
      try {
        const session = await fetchAuthSession();
        const groups = (session.tokens?.accessToken?.payload?.['cognito:groups'] as string[]) || [];
        setUserGroups(groups);
      } catch (err) {
        console.error('Failed to get user groups:', err);
      } finally {
        setLoading(false);
      }
    }
    getGroups();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-ace-muted">Loading...</div>
      </div>
    );
  }

  // Customer portal
  const isCustomer = userGroups.includes('customer') && !userGroups.includes('owner') && !userGroups.includes('manager');

  if (isCustomer) {
    return (
      <CustomerLayout user={user} signOut={signOut}>
        <Routes>
          <Route path="/portal" element={<MyEvents />} />
          <Route path="/portal/invoices" element={<MyInvoices />} />
          <Route path="/portal/messages" element={<MyMessages />} />
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Routes>
      </CustomerLayout>
    );
  }

  // Admin portal (owner, manager, crew, performer)
  return (
    <Layout user={user} signOut={signOut}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/quotes/:id" element={<QuoteDetail />} />
        <Route path="/gigs" element={<Gigs />} />
        <Route path="/gigs/:id" element={<GigDetail />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/equipment" element={<Equipment />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/invoices/create" element={<InvoiceCreate />} />
        <Route path="/invoices/:id" element={<InvoiceDetail />} />
        <Route path="/crew" element={<Crew />} />
        <Route path="/subscribers" element={<Subscribers />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => <AppContent signOut={signOut} user={user} />}
    </Authenticator>
  );
}
