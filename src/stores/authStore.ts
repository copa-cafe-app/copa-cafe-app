import { create } from 'zustand';
import { authService, type OtpChannel } from '../services/auth.service';
import { userService } from '../services/user.service';
import type { User } from '../types/user';

interface AuthState {
  user: any | null;
  session: any | null;
  profile: User | null;
  initialized: boolean;
  loading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  loadProfile: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  sendOtp: (phone: string, channel?: OtpChannel) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<{ is_new_user?: boolean }>;
  // Fallback SMS nativo do Supabase
  sendSmsOtp: (phone: string) => Promise<void>;
  verifySmsOtp: (phone: string, token: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  onboardingDone: boolean | null;
  setOnboardingDone: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  initialized: false,
  loading: false,
  error: null,

  initialize: async () => {
    try {
      const session = await authService.getSession();
      set({ session, user: session?.user ?? null, initialized: true });

      if (session?.user) {
        get().loadProfile();
      }

      authService.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null });
        if (session?.user) {
          get().loadProfile();
        } else {
          set({ profile: null });
        }
      });
    } catch {
      set({ initialized: true });
    }
  },

  loadProfile: async () => {
    const { user } = get();
    if (!user) return;
    try {
      const profile = await userService.getProfile(user.id);
      set({ profile });
      if (profile) {
        userService.updateLastLogin(user.id);
      }
    } catch {
      // Profile may not exist yet (during registration)
    }
  },

  signUp: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const data = await authService.signUp(email, password);
      set({ user: data.user, session: data.session, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const data = await authService.signIn(email, password);
      set({ user: data.user, session: data.session, loading: false });
      if (data.user) {
        await get().loadProfile();
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // WhatsApp / SMS via Twilio Verify (Edge Functions)
  sendOtp: async (phone, channel = 'whatsapp') => {
    set({ loading: true, error: null });
    try {
      await authService.sendOtp(phone, channel);
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  verifyOtp: async (phone, code) => {
    set({ loading: true, error: null });
    try {
      const data = await authService.verifyOtp(phone, code);
      set({ user: data.user, session: data.session, loading: false });
      if (data.user) {
        get().loadProfile();
      }
      return { is_new_user: data.is_new_user };
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  // Fallback: SMS nativo do Supabase
  sendSmsOtp: async (phone) => {
    set({ loading: true, error: null });
    try {
      await authService.sendSmsOtp(phone);
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  verifySmsOtp: async (phone, token) => {
    set({ loading: true, error: null });
    try {
      const data = await authService.verifySmsOtp(phone, token);
      set({ user: data.user, session: data.session, loading: false });
      if (data.user) {
        get().loadProfile();
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  signInWithGoogle: async () => {
    set({ loading: true, error: null });
    try {
      const data = await authService.signInWithGoogle();
      set({ user: data.user, session: data.session, loading: false });
      if (data.user) {
        await get().loadProfile();
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  signInWithFacebook: async () => {
    set({ loading: true, error: null });
    try {
      const data = await authService.signInWithFacebook();
      set({ user: data.user, session: data.session, loading: false });
      if (data.user) {
        await get().loadProfile();
      }
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  resetPassword: async (email) => {
    set({ loading: true, error: null });
    try {
      await authService.resetPassword(email);
      set({ loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  signOut: async () => {
    set({ loading: true });
    try {
      await authService.signOut();
      set({ user: null, session: null, profile: null, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  clearError: () => set({ error: null }),
  onboardingDone: null,
  setOnboardingDone: (val) => set({ onboardingDone: val }),
}));
