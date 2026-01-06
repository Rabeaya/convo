/**
 * Authentication Store (Zustand)
 * 
 * Manages authentication state
 */

import { create } from 'zustand';
import type { LoginResponse, User, Account } from '../api/auth';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  account: Account | null;
  loginData: LoginResponse | null;
  setAuth: (loginData: LoginResponse) => void;
  clearAuth: () => void;
  setUser: (user: User) => void;
  setAccount: (account: Account) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  account: null,
  loginData: null,
  
  setAuth: (loginData: LoginResponse) => {
    const loggedIntoAccount = loginData.user_accounts.find(
      (acc) => acc.account_id === loginData.account_id
    );
    
    set({
      isAuthenticated: true,
      user: loginData.user,
      account: loggedIntoAccount || null,
      loginData,
    });
  },
  
  clearAuth: () => {
    set({
      isAuthenticated: false,
      user: null,
      account: null,
      loginData: null,
    });
  },
  
  setUser: (user: User) => {
    set({ user });
  },
  
  setAccount: (account: Account) => {
    set({ account });
  },
}));

