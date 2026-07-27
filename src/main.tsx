import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import App from './App';
import './index.css';

// Configure Amplify — fix groups format before any module reads it
const amplifyConfig = JSON.parse(JSON.stringify(outputs));
if (amplifyConfig.auth?.groups && Array.isArray(amplifyConfig.auth.groups)) {
  amplifyConfig.auth.groups = amplifyConfig.auth.groups.map((g: any) =>
    typeof g === 'string' ? g : Object.keys(g)[0]
  );
}
Amplify.configure(amplifyConfig);

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
