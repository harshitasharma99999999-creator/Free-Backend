'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { type User, type ApiKeyCreated, keys as keysApi } from '@/lib/api';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  /** True when a Firebase user is signed in — all backend calls will work. */
  backendConnected: boolean;
  setUser: (u: User | null) => void;
  logout: () => void;
  /** Legacy helpers kept so login/register pages compile without changes. */
  login: (token: string, user: User) => void;
  loginFirebaseOnly: (user: User) => void;
  refreshUser: () => Promise<void>;
  exchangeFirebaseToken: (idToken: string) => Promise<{ user: User; token: string }>;
  createApiKey: (name: string) => Promise<ApiKeyCreated>;
};

const AuthContext = createContext<AuthContextType | null>(null);

function fbToUser(fb: FirebaseUser): User {
  return {
    id: fb.uid,
    email: fb.email ?? '',
    name: fb.displayName ?? fb.email ?? 'User',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (fb) => {
      setUser(fb ? fbToUser(fb) : null);
      setLoading(false);
    });
    return unsub;
  }, []);

  const logout = () => {
    setUser(null);
    // Clear any legacy stored token
    if (typeof window !== 'undefined') localStorage.removeItem('token');
    firebaseSignOut(firebaseAuth).catch(() => {});
  };

  // ── Legacy shims so login/register pages still compile ──────────────────────
  const login = (_token: string, u: User) => setUser(u);
  const loginFirebaseOnly = (u: User) => setUser(u);

  const refreshUser = async () => {
    const fb = firebaseAuth.currentUser;
    if (fb) setUser(fbToUser(fb));
  };

  // No longer needed — kept so call sites compile without changes
  const exchangeFirebaseToken = async (_idToken: string): Promise<{ user: User; token: string }> => {
    const fb = firebaseAuth.currentUser;
    const u = fb ? fbToUser(fb) : { id: '', email: '', name: '' };
    return { user: u, token: '' };
  };

  const createApiKey = async (name: string): Promise<ApiKeyCreated> => {
    if (!user) {
      throw new Error('Authentication required. Please sign in to create API keys.');
    }
    
    try {
      return await keysApi.create(name);
    } catch (error) {
      // Provide more specific error messages for authentication issues
      if (error instanceof Error) {
        if (error.message.includes('Authentication required')) {
          throw new Error('Authentication required. Please sign in to create API keys.');
        }
        if (error.message.includes('Invalid Firebase token')) {
          throw new Error('Your session has expired. Please sign out and sign in again.');
        }
        if (error.message.includes('Unauthorized')) {
          throw new Error('Authentication failed. Please sign out and sign in again.');
        }
      }
      throw error;
    }
  };

  // Connected whenever a Firebase user exists (no custom JWT needed)
  const backendConnected = !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        backendConnected,
        setUser,
        logout,
        login,
        loginFirebaseOnly,
        refreshUser,
        exchangeFirebaseToken,
        createApiKey,
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
