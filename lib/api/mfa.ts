import { apiClient, type ApiResponse } from './client';

export type MfaApiResponse<T> = ApiResponse<T> & { type: number; message?: string; data?: T };

export interface SecretAndQRCode {
  secret: string;
  qr_code: string; // base64 data URL from server
}

export interface VerifyCodeResponseData {
  backup_codes?: Array<{ backup_code: string; consumed_at?: unknown }>;
  account_name?: string;
  redirect_url?: string;
  network_switched?: boolean;
  [key: string]: unknown;
}

class MfaService {
  async getSecretAndQRCode() {
    return apiClient.post<MfaApiResponse<SecretAndQRCode>>('/api/v1/mfa', { method: 'getSecretAndQRCode' });
  }

  async sendVerificationCodeToPhoneNumber(phone_number: string) {
    return apiClient.post<MfaApiResponse<unknown>>('/api/v1/mfa', {
      method: 'sendVerificationCodeToPhoneNumber',
      data: { phone_number },
    });
  }

  async resendVerificationCode(phone_number: string) {
    return apiClient.post<MfaApiResponse<unknown>>('/api/v1/mfa', {
      method: 'resendVerificationCode',
      data: { phone_number },
    });
  }

  async verifyCode(params: { auth_method: 'SMS' | 'AUTH_APP'; verification_code: string; is_default: number; account_id?: string }) {
    return apiClient.post<MfaApiResponse<VerifyCodeResponseData>>('/api/v1/mfa', {
      method: 'verifyCode',
      data: {
        auth_method: params.auth_method,
        verification_code: params.verification_code,
        is_default: params.is_default,
        account_id: params.account_id || '',
      },
    });
  }
}

export const mfaService = new MfaService();


