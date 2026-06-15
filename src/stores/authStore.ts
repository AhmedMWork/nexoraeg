// ============================================================
// NEXORA V5 — Studio Session Store
// Admin access is enforced by StudioGate + signed Edge Function token.
// This lightweight store only represents local Studio UI identity.
// ============================================================

import { create } from 'zustand';
import type { Admin } from '@/types';
import { clearStudioToken, getStudioToken } from '@/lib/supabase/client';

interface AuthStore {
  user: Admin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (_email?: string, _password?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: Admin | null) => void;
  setLoading: (loading: boolean) => void;
}

const studioAdmin: Admin = {
  uid: 'studio',
  email: 'studio@nexora.local',
  displayName: 'NEXORA Studio',
  role: 'owner',
  permissions: ['all'],
  createdAt: new Date(),
  lastLoginAt: new Date(),
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: getStudioToken() ? studioAdmin : null,
  isAuthenticated: !!getStudioToken(),
  isLoading: false,

  login: async () => {
    set({ user: studioAdmin, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    clearStudioToken();
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
}));

export function initAuthListener() {
  useAuthStore.getState().setLoading(false);
  return () => {};
}
