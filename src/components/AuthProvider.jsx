import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getMe, logout as apiLogout } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshSeqRef = useRef(0);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    const seq = ++refreshSeqRef.current;
    if(!silent) {
      setLoading(true);
    }
    try {
      const me = await getMe();
      if(seq !== refreshSeqRef.current) {
        return;
      }
      setUser(me);
    } catch {
      if(seq !== refreshSeqRef.current) {
        return;
      }
      setUser(null);
    } finally {
      if(seq !== refreshSeqRef.current) {
        return;
      }
      if(!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    refreshSeqRef.current += 1;
    await apiLogout();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, setUser, refresh, logout }), [user, loading, refresh, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if(!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
