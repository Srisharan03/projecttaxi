import { create } from "zustand";
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

export const useAuthStore = create<AuthStoreState>((set, get) => ({
  user: null,
  role: "user",
  initialized: false,
  unsubscribeAuth: null,

  initializeAuth: () => {
    if (get().unsubscribeAuth) {
      return;
    }

    const unsubscribe = subscribeToAuthState((user) => {
      set({ user, initialized: true });
    });

    set({ unsubscribeAuth: unsubscribe });
  },

  setRole: (role) => set({ role }),

  clearAuth: () => {
    const unsubscribe = get().unsubscribeAuth;
    if (unsubscribe) {
      unsubscribe();
    }

    set({ user: null, initialized: false, unsubscribeAuth: null, role: "user" });
  },
}));
