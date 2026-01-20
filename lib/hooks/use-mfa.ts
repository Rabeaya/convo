import { useMutation, useQuery } from '@tanstack/react-query';
import type { ApiError } from '@/lib/api/client';
import { mfaService, type SecretAndQRCode, type VerifyCodeResponseData } from '@/lib/api/mfa';

export function useMfaSecretAndQRCode(enabled: boolean) {
  return useQuery<{ type: number; message?: string; data?: SecretAndQRCode }, ApiError>({
    queryKey: ['mfaSecretAndQRCode'],
    queryFn: async () => {
      const resp = await mfaService.getSecretAndQRCode();
      return (resp.data as any) || resp;
    },
    enabled,
    staleTime: 0,
    retry: true,
  });
}

export function useMfaSendVerificationCode() {
  return useMutation({
    mutationFn: async (phone_number: string) => {
      const resp = await mfaService.sendVerificationCodeToPhoneNumber(phone_number);
      return (resp.data as any) || resp;
    },
  });
}

export function useMfaResendVerificationCode() {
  return useMutation({
    mutationFn: async (phone_number: string) => {
      const resp = await mfaService.resendVerificationCode(phone_number);
      return (resp.data as any) || resp;
    },
  });
}

export function useMfaVerifyCode() {
  return useMutation({
    mutationFn: async (params: { auth_method: 'SMS' | 'AUTH_APP'; verification_code: string; is_default: number; account_id?: string }) => {
      const resp = await mfaService.verifyCode(params);
      return (resp.data as any) || resp;
    },
  });
}



