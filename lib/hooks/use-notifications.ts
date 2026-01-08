import { useMutation, useQuery } from '@tanstack/react-query';
import type { ApiError } from '@/lib/api/client';
import { stdHashtagsService, type SubscriptionTagSearchItem } from '@/lib/api/stdhashtags';

export function useSubscriptionSettings(enabled: boolean) {
  return useQuery<{ type?: number; errorCode?: number; data?: { tagsearch: SubscriptionTagSearchItem[] } }, ApiError>({
    queryKey: ['subscriptionSettings'],
    queryFn: async () => {
      const resp = await stdHashtagsService.readSubscriptionSettings();
      return (resp.data as any) || resp;
    },
    enabled,
    staleTime: 0,
  });
}

export function useUpdateSubscriptionSettings() {
  return useMutation({
    mutationFn: async (item: SubscriptionTagSearchItem) => {
      const resp = await stdHashtagsService.updateSubscriptionSettings(item);
      return (resp.data as any) || resp;
    },
  });
}

export function useProcessSubscription() {
  return useMutation({
    mutationFn: async (params: { action: 'unsubscribe' | 'subscribe'; value: string[]; url?: string }) => {
      const resp = await stdHashtagsService.processSubscription(params);
      return (resp.data as any) || resp;
    },
  });
}


