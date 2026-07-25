import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import App from './App';
import './index.css';

// Configure Amplify with backend outputs
// Fix: groups format compatibility with Authenticator
const config = { ...outputs };
if (config.auth?.groups) {
  // Convert [{owner: {precedence: 0}}] to ['owner', 'manager', ...]
  config.auth.groups = config.auth.groups.map((g: any) => Object.keys(g)[0]) as any;
}
Amplify.configure(config as any);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
