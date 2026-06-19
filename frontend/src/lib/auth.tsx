'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from './api';

export interface SessionUser {
  id: string;
  email: string;
  role: string;
  profileId: string | null;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Restore session from a stored token on first load.
    if (!tokenStore.access) {
      setLoading(false);
      return;
    }
    api
      .get<SessionUser>('/auth/me')
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const u = await api.login(email, password);
    setUser(u);
    router.push('/dashboard');
  }

  function logout() {
    const refresh = tokenStore.refresh;
    if (refresh) api.post('/auth/logout', { refreshToken: refresh }).catch(() => undefined);
    tokenStore.clear();
    setUser(null);
    router.push('/login');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
