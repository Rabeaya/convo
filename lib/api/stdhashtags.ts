import { apiClient, type ApiResponse } from '@/lib/api/client';

export interface StdHashtagsResponse<T = any> {
  type?: number;
  errorCode?: number;
  message?: string;
  data?: T;
  [key: string]: unknown;
}

export type SubscriptionTagSearchItem = {
  value: string[]; // tags list
  settings: {
    desktop: boolean;
    email: boolean;
    mobile: boolean;
    in_app: boolean;
  };
  [key: string]: unknown;
};

class StdHashtagsService {
  async readSubscriptionSettings() {
    return apiClient.get<StdHashtagsResponse<{ tagsearch: SubscriptionTagSearchItem[] }>>('/api/v1/stdhashtags', {
      method: 'readSubscriptionSettings',
    });
  }

  async updateSubscriptionSettings(tagsearchItem: SubscriptionTagSearchItem) {
    return apiClient.post<StdHashtagsResponse>('/api/v1/stdhashtags', {
      method: 'updateSubscriptionSettings',
      tagsearch: tagsearchItem,
    });
  }

  async processSubscription(params: { action: 'unsubscribe' | 'subscribe'; value: string[]; url?: string }) {
    return apiClient.post<StdHashtagsResponse>('/api/v1/stdhashtags', {
      method: 'processSubscription',
      action: params.action,
      url: params.url,
      value: params.value,
    });
  }
}

export const stdHashtagsService = new StdHashtagsService();


