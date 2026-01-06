/**
 * Settings API Hooks
 * 
 * Migrated from AngularJS settingsService
 * Exact 1:1 match of API calls
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface GeneralSettings {
  password_policy?: {
    password_min_length: number;
    password_complexity: number;
  };
  sso_settings?: {
    is_sso_optional: number;
    sso_enabled: number;
  };
  mfa?: MultiFactorAuth;
  [key: string]: any;
}

export interface MultiFactorAuth {
  mfa_enabled: boolean;
  mfa_methods?: Array<{
    method: string;
    is_default: boolean;
    phone_number?: string;
  }>;
  SMS?: {
    is_default: boolean;
    phone_number: string;
  };
  AUTH_APP?: {
    is_default: boolean;
  };
  backupCodes?: string[];
  num_of_unused_backup_codes?: number;
  accountName?: string;
  allow_deactivate?: boolean;
  deactivating?: boolean;
}

export interface ApiResponse<T = any> {
  type: number;
  message?: string;
  data?: T;
}

// Get general settings - matches settingsService.getGeneralSettings
export function useGeneralSettings(refetchFromServer = false, mode: 'NORMAL' | 'ADMIN' = 'NORMAL') {
  return useQuery({
    queryKey: ['generalSettings', refetchFromServer, mode],
    queryFn: async () => {
      const settingUrl = mode === 'ADMIN' 
        ? '/admin/networknotificationsetting?method=readNetworkSettingsTemplate'
        : '/settings';
      const response = await apiClient.get<GeneralSettings | { data: GeneralSettings }>(settingUrl);
      // AngularJS returns { type: 1, data: {...} } format
      // For admin mode, it may return { data: { network_notifications_settings: {...} } }
      if (mode === 'ADMIN' && response.data && 'network_notifications_settings' in (response.data as any)) {
        return (response.data as any).network_notifications_settings;
      }
      // Normal mode returns data directly or nested in data.data
      if (response.data && 'data' in response.data) {
        return (response.data as any).data;
      }
      return response.data || response;
    },
    staleTime: refetchFromServer ? 0 : 5 * 60 * 1000,
  });
}

// Reset password - matches userInfo.resetPassword
export function useResetPassword() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { current_password: string; new_password: string }) => {
      const response = await apiClient.post<ApiResponse>('/passwordreset', {
        method: 'changePassword',
        current_password: data.current_password,
        new_password: data.new_password
      });
      return (response.data as any) || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generalSettings'] });
    }
  });
}

// Change email - matches userInfo.changeEmail
export function useChangeEmail() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (newEmail: string) => {
      const response = await apiClient.post<ApiResponse<{ email?: string }>>('/user', {
        method: 'changeEmail',
        new_email: newEmail
      });
      // Return the full response structure matching AngularJS
      if (response.data && typeof response.data === 'object' && 'type' in response.data) {
        return response.data as ApiResponse<{ email?: string }>;
      }
      return {
        type: 1,
        data: response.data,
        message: 'Email updated successfully'
      } as ApiResponse<{ email?: string }>;
    },
    onSuccess: (response) => {
      // Invalidate user queries to refresh user data
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['session'] });
    }
  });
}

// Hide/show user info - matches userInfo.hideUserInfo
export function useHideUserInfo() {
  return useMutation({
    mutationFn: async (data: { type: 'phone' | 'email'; value: number }) => {
      const response = await apiClient.put<ApiResponse>('/user/profiles', {
        method: 'showHideEmailOrPhone',
        type: data.type,
        value: data.value
      });
      return (response.data as any) || response;
    }
  });
}

// Sign out all other sessions - matches settingsService.expireAllOtherUserSessions
export function useExpireAllOtherSessions() {
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ApiResponse>('/mfa', {
        method: 'expireAllOtherUserSessions'
      });
      return (response.data as any) || response;
    }
  });
}

// Deactivate MFA - matches settingsService.deactivateRequiredMfaForLoggedInUser
export function useDeactivateMfa() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<ApiResponse>('/mfa', {
        method: 'deactivateMfaForUser'
      });
      return (response.data as any) || response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generalSettings'] });
    }
  });
}

// Get backup codes - matches settingsService.getBackupCodes
export function useBackupCodes() {
  return useQuery({
    queryKey: ['backupCodes'],
    queryFn: async () => {
      const response = await apiClient.post<ApiResponse<{ backup_codes: string[]; account_name: string }>>('/mfa', {
        method: 'getAllBackupCodesOfUser'
      });
      return (response.data as any) || response;
    }
  });
}

// Remove user from network - matches Users.removeUserFromNetwork
export function useRemoveUserFromNetwork() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await apiClient.post<ApiResponse>('/users', {
        method: 'removeUserFromNetwork',
        user_id: userId
      });
      return (response.data as any) || response;
    }
  });
}
