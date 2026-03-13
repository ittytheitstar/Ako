'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { tryRefreshToken } from './auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuthenticated: (val: boolean) => void;
}

const AuthContext = createContext<AuthState>({
  isAuthenticated: false,
  isLoading: true,
  setAuthenticated: () => void 0,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    tryRefreshToken().then((ok) => {
      setAuthenticated(ok);
      setIsLoading(false);
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ isAuthenticated, isLoading, setAuthenticated }}>
        {children}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}
