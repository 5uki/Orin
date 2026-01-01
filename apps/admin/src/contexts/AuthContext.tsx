import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User } from '@orin/shared/types';
import { authApi } from '../services/api';

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (redirect?: string) => void;
  devLogin: (username: string, isAdmin?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  isDevelopment: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAdmin: false,
    isLoading: true,
    isAuthenticated: false,
  });

  const isDevelopment = authApi.isDevelopment();

  const refresh = useCallback(async () => {
    try {
      const result = await authApi.getMe();
      if (result && result.user) {
        setState({
          user: result.user,
          isAdmin: result.isAdmin,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        setState({
          user: null,
          isAdmin: false,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    } catch {
      setState({
        user: null,
        isAdmin: false,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback((redirect?: string) => {
    const loginUrl = authApi.getLoginUrl(redirect || '/admin');
    window.location.href = loginUrl;
  }, []);

  const devLogin = useCallback(async (username: string, isAdmin: boolean = false) => {
    try {
      const result = await authApi.devLogin(username, isAdmin);
      if (result && result.user) {
        setState({
          user: result.user,
          isAdmin: result.isAdmin,
          isLoading: false,
          isAuthenticated: true,
        });
      }
    } catch (error) {
      console.error('Development login failed:', error);
    }
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setState({
      user: null,
      isAdmin: false,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, devLogin, logout, refresh, isDevelopment }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
