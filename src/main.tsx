import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
import App from './App';
import './index.css';

// Configure Amplify — remove groups to prevent Authenticator crash
const amplifyConfig: any = { ...outputs };
if (amplifyConfig.auth) {
  delete amplifyConfig.auth.groups;
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
