import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feedService, FeedFetchRequest, FeedFetchResponse, FeedPollRequest, FeedPollResponse } from '../api/feed';
import { useAuthStore } from '../stores/auth-store';
import { ApiError } from '../api/client';

const ITEMS_TO_FETCH_PER_CALL = 10;

export interface UseFeedOptions {
  filter?: any;
  isSearch?: boolean;
  enabled?: boolean;
}

export function useFeed(options: UseFeedOptions = {}) {
  const { filter, isSearch = false, enabled = true } = options;
  const { loginData, user, account } = useAuthStore();

  const queryKey = ['feed', filter, isSearch];

  const query = useQuery<FeedFetchResponse, ApiError>({
    queryKey,
    queryFn: async () => {
      if (!loginData || !user || !account || !user.user_id) {
        throw new Error('Not authenticated');
      }

      const request: FeedFetchRequest = {
        authToken: loginData.xmpp_session_token,
        userID: user.user_id,
        accountID: account.account_id,
        fromIndex: 0,
        itemsCount: ITEMS_TO_FETCH_PER_CALL,
        summaryParams: null,
        sortBy: 1,
        feedIDsWithTimestamp: null,
        filter: filter || null,
        isSearch: isSearch,
        includeChats: false,
        includeDrafts: false,
        applyHighlight: true,
        postDisplayOption: 'latestActivity',
      };

      const response = await feedService.fetchFeed(request);
      return response.data;
    },
    enabled: enabled && !!loginData && !!user && !!account,
    staleTime: 0, // Feed data should always be fresh
  });

  return {
    ...query,
    feedItems: query.data?.feed_items || [],
    users: query.data?.users || {},
    groups: query.data?.groups || {},
    pinnedItems: query.data?.pinned_items || [],
  };
}

// TODO: Implement useFeedInfinite using useInfiniteQuery when infinite scroll is needed
// export function useFeedInfinite(options: UseFeedOptions = {}) {
//   const { filter, isSearch = false, enabled = true } = options;
//   const { loginData, user, account } = useAuthStore();
//
//   return useInfiniteQuery({
//     queryKey: ['feed-infinite', filter, isSearch],
//     queryFn: async ({ pageParam = 0 }) => {
//       if (!loginData || !user || !account || !user.user_id) {
//         throw new Error('Not authenticated');
//       }
//
//       const request: FeedFetchRequest = {
//         authToken: loginData.xmpp_session_token,
//         userID: user.user_id,
//         accountID: account.account_id,
//         fromIndex: pageParam as number,
//         itemsCount: ITEMS_TO_FETCH_PER_CALL,
//         summaryParams: null,
//         sortBy: 1,
//         feedIDsWithTimestamp: null,
//         filter: filter || null,
//         isSearch: isSearch,
//         includeChats: false,
//         includeDrafts: false,
//         applyHighlight: true,
//         postDisplayOption: 'latestActivity',
//       };
//
//       const response = await feedService.fetchFeed(request);
//       return response.data;
//     },
//     enabled: enabled && !!loginData && !!user && !!account,
//     getNextPageParam: (lastPage, allPages) => {
//       const allItems = allPages.flatMap(page => page.feed_items || []);
//       return allItems.length;
//     },
//     initialPageParam: 0,
//   });
// }

export function useFeedPoll(options: UseFeedOptions = {}) {
  const { filter } = options;
  const { loginData, user, account } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation<FeedPollResponse, ApiError, { lastPollTimestamp?: string }>({
    mutationFn: async ({ lastPollTimestamp }) => {
      if (!loginData || !user || !account) {
        throw new Error('Not authenticated');
      }

      const userId = (user as any).user_id || (user as any).userId;
      const accountId = (account as any).account_id;
      
      const request: FeedPollRequest = {
        authToken: loginData.xmpp_session_token,
        userID: userId,
        accountID: accountId,
        filter: filter || null,
        includeChats: false,
        includeDrafts: false,
        applyHighlight: true,
        mark_notifications: 1,
        client: 'w2',
        postDisplayOption: 'latestActivity',
        lastFeedPollTimestamp: lastPollTimestamp,
      };

      const response = await feedService.pollFeed(request);
      return response.data;
    },
    onSuccess: (data) => {
      // Update feed cache with new items
      queryClient.setQueryData(['feed', filter], (old: FeedFetchResponse | undefined) => {
        if (!old) return old;
        
        const newItems = data.feed_items || [];
        const existingItems = old.feed_items || [];
        
        // Merge new items, avoiding duplicates
        const existingIds = new Set(existingItems.map(item => item.feed_id));
        const uniqueNewItems = newItems.filter(item => !existingIds.has(item.feed_id));
        
        return {
          ...old,
          feed_items: [...uniqueNewItems, ...existingItems],
          users: { ...old.users, ...(data.users || {}) },
          groups: { ...old.groups, ...(data.groups || {}) },
        };
      });
    },
  });
}

