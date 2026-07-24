import { Authenticator } from '@aws-amplify/ui-react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './layouts/Layout';
import Dashboard from './pages/Dashboard';
import Quotes from './pages/Quotes';
import QuoteDetail from './pages/QuoteDetail';
import Gigs from './pages/Gigs';
import GigDetail from './pages/GigDetail';
import Clients from './pages/Clients';
import Equipment from './pages/Equipment';
import Invoices from './pages/Invoices';
import Crew from './pages/Crew';
import Subscribers from './pages/Subscribers';
import Settings from './pages/Settings';
import '@aws-amplify/ui-react/styles.css';

export default function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
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
            <Route path="/crew" element={<Crew />} />
            <Route path="/subscribers" element={<Subscribers />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      )}
    </Authenticator>
  );
}
