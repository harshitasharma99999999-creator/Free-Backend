'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { api, type User } from '@/lib/api';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  /** True when we have a backend JWT (API keys and usage will work). */
  backendConnected: boolean;
  login: (token: string, user: User) => void;
  /** Sign in with Firebase user only (no backend token). Dashboard works; keys/usage need backend. */
  loginFirebaseOnly: (user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  exchangeFirebaseToken: (idToken: string) => Promise<{ user: User; token: string }>;
};

const AuthContext = createContext<AuthContextType | null>(null);

function firebaseUserToUser(fb: FirebaseUser): User {
  return {
    id: fb.uid,
    email: fb.email ?? '',
    name: fb.displayName ?? fb.email ?? 'User',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const login = (token: string, u: User) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      setUser(u);
    }
  };

  const loginFirebaseOnly = (u: User) => {
    if (typeof window !== 'undefined') localStorage.removeItem('token');
    setUser(u);
  };

  const logout = () => {
    if (typeof window !== 'undefined') localStorage.removeItem('token');
    setUser(null);
    firebaseSignOut(firebaseAuth).catch(() => {});
  };

  const exchangeFirebaseToken = async (idToken: string) => {
    const res = await api<{ user: User; token: string }>('/api/auth/firebase', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    return res;
  };

  const refreshUser = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      const fbUser = firebaseAuth.currentUser;
      if (fbUser) {
        const idToken = await fbUser.getIdToken();
        try {
          const { user: u, token: t } = await exchangeFirebaseToken(idToken);
          localStorage.setItem('token', t);
          setUser(u);
        } catch {
          setUser(firebaseUserToUser(fbUser));
        }
      } else {
        setUser(null);
      }
      setLoading(false);
      return;
    }
    try {
      const { user: u } = await api<{ user: User }>('/api/auth/me');
      setUser(u);
    } catch {
      const fbUser = firebaseAuth.currentUser;
      if (fbUser) {
        const idToken = await fbUser.getIdToken();
        try {
          const { user: u, token: t } = await exchangeFirebaseToken(idToken);
          localStorage.setItem('token', t);
          setUser(u);
        } catch {
          setUser(firebaseUserToUser(fbUser));
        }
      } else {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      if (!fbUser) {
        if (typeof window !== 'undefined') localStorage.removeItem('token');
        setUser(null);
        setLoading(false);
        return;
      }
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) {
        try {
          const { user: u } = await api<{ user: User }>('/api/auth/me');
          setUser(u);
        } catch {
          const idToken = await fbUser.getIdToken();
          try {
            const { user: u, token: t } = await exchangeFirebaseToken(idToken);
            if (typeof window !== 'undefined') localStorage.setItem('token', t);
            setUser(u);
          } catch {
            setUser(firebaseUserToUser(fbUser));
          }
        }
      } else {
        // No backend token (e.g. page refresh): exchange Firebase token for JWT so API keys/usage work
        const idToken = await fbUser.getIdToken();
        try {
          const { user: u, token: t } = await exchangeFirebaseToken(idToken);
          if (typeof window !== 'undefined') localStorage.setItem('token', t);
          setUser(u);
        } catch {
          setUser(firebaseUserToUser(fbUser));
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const backendConnected =
    typeof window !== 'undefined' && !!localStorage.getItem('token');

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        backendConnected,
        login,
        loginFirebaseOnly,
        logout,
        refreshUser,
        exchangeFirebaseToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
