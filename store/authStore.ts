import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "firebase/auth";
import { subscribeToAuthState } from "@/lib/auth";

type UserRole = "user" | "vendor" | "admin";

interface AuthStoreState {
  user: User | null;
  role: UserRole;
  initialized: boolean;
  unsubscribeAuth: (() => void) | null;
  initializeAuth: () => void;
  setRole: (role: UserRole) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set, get) => ({
      user: null,
      role: "user",
      initialized: false,
      unsubscribeAuth: null,

      initializeAuth: () => {
        if (get().unsubscribeAuth) {
          return;
        }

        let settled = false;
        const initTimeout = window.setTimeout(() => {
          if (!settled) {
            console.warn("[AuthStore] Auth state check timed out. Falling back to initialized=true.");
            set({ initialized: true });
          }
        }, 7000);

        const unsubscribe = subscribeToAuthState(
          (user) => {
            settled = true;
            window.clearTimeout(initTimeout);
            set({ user, initialized: true });
          },
          (error) => {
            settled = true;
            window.clearTimeout(initTimeout);
            console.error("[AuthStore] Auth state subscription failed", error);
            set({ user: null, initialized: true });
          },
        );

        set({
          unsubscribeAuth: () => {
            window.clearTimeout(initTimeout);
            unsubscribe();
          },
        });
      },

      setRole: (role) => set({ role }),

      clearAuth: () => {
        const unsubscribe = get().unsubscribeAuth;
        if (unsubscribe) {
          unsubscribe();
        }

        set({ user: null, initialized: false, unsubscribeAuth: null, role: "user" });
      },
    }),
    {
      name: "parksaathi-auth-store",
      partialize: (state) => ({ role: state.role }),
    },
  ),
);
