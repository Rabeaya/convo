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

const SETTINGS_API_URL_NORMAL = '/api/v1/settings';
const SETTINGS_API_URL_ADMIN = '/admin/networknotificationsetting?method=readNetworkSettingsTemplate';

// Get general settings - matches settingsService.getGeneralSettings
export function useGeneralSettings(refetchFromServer = false, mode: 'NORMAL' | 'ADMIN' = 'NORMAL') {
  return useQuery({
    queryKey: ['generalSettings', refetchFromServer, mode],
    queryFn: async () => {
      const settingUrl = mode === 'ADMIN' ? SETTINGS_API_URL_ADMIN : SETTINGS_API_URL_NORMAL;
      const response = await apiClient.get<GeneralSettings | { data: GeneralSettings }>(settingUrl);
      // AngularJS returns { type: 1, data: {...} } format
      // For admin mode, it may return { data: { network_notifications_settings: {...} } }
      if (mode === 'ADMIN' && response.data && 'network_notifications_settings' in (response.data as any)) {
        return (response.data as any).network_notifications_settings;
      }
      // Normal mode returns either:
      // - { type, data } (Angular-style)
      // - { data: {...} } (some proxies)
      // - direct {...}
      // Be strict to avoid accidentally unwrapping legitimate settings fields named `data`.
      if (response.data && typeof response.data === 'object') {
        const any = response.data as any;
        if ('type' in any && 'data' in any) return any.data;
        if (!('type' in any) && 'data' in any && any.data && typeof any.data === 'object') return any.data;
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
      const response = await apiClient.post<ApiResponse>('/api/v1/passwordreset', {
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
      const response = await apiClient.post<ApiResponse<{ email?: string }>>('/api/v1/user', {
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
      const response = await apiClient.put<ApiResponse>('/api/v1/user/profiles', {
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
      const response = await apiClient.post<ApiResponse>('/api/v1/mfa', {
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
      const response = await apiClient.post<ApiResponse>('/api/v1/mfa', {
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
      const response = await apiClient.post<ApiResponse<{ backup_codes: Array<{ backup_code: string; consumed_at?: unknown }>; account_name: string }>>(
        '/api/v1/mfa',
        {
          method: 'getAllBackupCodesOfUser',
        }
      );
      return (response.data as any) || response;
    }
  });
}

// Remove user from network - matches Users.removeUserFromNetwork
export function useRemoveUserFromNetwork() {
  return useMutation({
    mutationFn: async (userId: string) => {
      // Angular Users.removeUserFromNetwork calls POST accounts { method: 'removeUser', user_id }.
      const response = await apiClient.post<ApiResponse>('/api/v1/accounts', { method: 'removeUser', user_id: userId });
      return (response.data as any) || response;
    }
  });
}

// Save setting by name - matches settingsService.saveSettingByName
export function useSaveSettingByName() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { settingName: string; value: any }) => {
      const { settingName, value } = data;
      const settings: Record<string, any> = {};
      settings[settingName] = value;
      
      // POST to backend via Next.js API proxy (matches AngularJS saveGeneralSettings)
      const response = await apiClient.post<ApiResponse>(SETTINGS_API_URL_NORMAL, settings);
      
      return (response.data as any) || response;
    },
    onSuccess: async () => {
      // Angular explicitly calls getGeneralSettings(true) after some saves (e.g., sharing_options_list),
      // which triggers an immediate GET /settings. Do the same unconditionally for parity.
      // Also update any cached generalSettings variants so UIs rehydrate correctly.
      try {
        const response = await apiClient.get<GeneralSettings | { data: GeneralSettings }>(SETTINGS_API_URL_NORMAL);

        // Mirror useGeneralSettings' normalization (NORMAL mode).
        // IMPORTANT: Do NOT unwrap `network_notifications_settings` here; that's ADMIN-mode only and would drop `sso_settings`, `mfa`, etc.
        let next: any = response.data;
        // Common shapes: { type, data }, { data: {...} }, or direct {...}
        if (next && typeof next === 'object' && 'data' in next) {
          next = (next as any).data;
        }
        if (next && typeof next === 'object' && 'type' in next && 'data' in next) {
          next = (next as any).data;
        }

        queryClient.setQueriesData({ queryKey: ['generalSettings'], exact: false }, next);
      } finally {
        // Still invalidate so anything else depending on generalSettings gets a chance to refetch.
        queryClient.invalidateQueries({ queryKey: ['generalSettings'], exact: false });
      }
    },
  });
}

// Get settings for customize feed - matches settingsService.getSettingsForCustomizeFeed
export function useCustomizeFeedSettings(refetchFromServer = false) {
  const { data: generalSettings, isLoading } = useGeneralSettings(refetchFromServer);
  
  return {
    data: generalSettings ? {
      sharing_options: generalSettings?.sharing_options || 0,
      sharing_options_list: generalSettings?.sharing_options_list || [],
      profile_groups_settings: generalSettings?.profile_groups_settings || [],
      regular_groups_settings: generalSettings?.regular_groups_settings || [],
      // Share link preference (not present in older Angular template in this repo, but requested for parity with newer UI)
      share_link_of_new_posts_in_chat:
        (generalSettings as any)?.share_link_of_new_posts_in_chat ?? (generalSettings as any)?.share_link_in_chat ?? (generalSettings as any)?.shareLinkInChat,
    } : undefined,
    isLoading,
  };
}

