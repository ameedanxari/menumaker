import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { useAuthStore } from './stores/authStore';
import './styles/index.css';
import './styles/mobile.css';

// Optimized React Query configuration for performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Caching strategy: stale-while-revalidate
      staleTime: 5 * 60 * 1000, // 5 minutes - data is fresh
      cacheTime: 30 * 60 * 1000, // 30 minutes - cache persists

      // Refetch behavior
      refetchOnWindowFocus: false, // Don't refetch on window focus
      refetchOnReconnect: true, // Refetch on network reconnect
      refetchOnMount: true, // Refetch on component mount if stale

      // Retry strategy
      retry: (failureCount, error: any) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        // Retry up to 2 times for network/server errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Performance
      structuralSharing: true, // Optimize re-renders
    },
    mutations: {
      // Retry mutations once on network errors
      retry: (failureCount, error: any) => {
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});

function AppInitializer() {
  const [isInitialized, setIsInitialized] = useState(false);
  const initAuth = useAuthStore((state) => state.initAuth);

  useEffect(() => {
    initAuth().finally(() => setIsInitialized(true));
  }, [initAuth]);

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppInitializer />
    </QueryClientProvider>
  </React.StrictMode>
);
